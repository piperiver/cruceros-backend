<?php

// Habilitar reportes de error útiles en cron
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Configuración
const URL = 'https://cruise.ovscruise.com/cruises/promos/new/cruise_search.jsp?pid=2&langrecno=3&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2JyYW5kIjoiMTEzIiwiY3VzdG9tZXJpZCI6Ik1EQzEwNTQ1MjAiLCJtZW1iZXJpZCI6Ik1EQzEwNTQ1MjAiLCJwaW4iOiIxMzI1IiwibmJmIjoxNzU1NjI2NDIxLCJleHAiOjE3NTU2MjY3ODEsImlzcyI6ImF1dGhvcml0eS5hcnJpdmlhLmNvbSIsImF1ZCI6Im92c2NydWlzZS5jb20ifQ.gp9m8p-ng2Ru8coFvASzZoIRyVq7zRmMB0PfY8_lWPo&CID=MDC&CBID=113&PIN=1325&tpid=&as=1&partnerid=186&nameid=39127934&specid=&cruiseline=-99&ship=-99&destination=19&dport=24&date=2X2026&dur=-99&prange=-99&sort=8&ord=1&webpagerecno=5793';
const HISTORY_FILE = __DIR__ . '/../public/historial.json';

// Utilidades
function normalize_text(string $text): string {
  // Normaliza espacios
  $text = preg_replace('/\s+/u', ' ', trim($text));

  // Intenta remover acentos conservando letras base
  if (class_exists('Normalizer')) {
    $text = Normalizer::normalize($text, Normalizer::FORM_D);
    $text = preg_replace('/\p{Mn}+/u', '', $text); // remueve marcas diacríticas
  } else {
    $tmp = @iconv('UTF-8', 'ASCII//TRANSLIT', $text);
    if ($tmp !== false) {
      $text = $tmp;
    }
  }

  return $text;
}

function clean_prices(array $prices): array {
  $cleaned = [];
  foreach ($prices as $key => $value) {
    $k = (string)$key;
    $k = normalize_text($k);
    // Homogeneizar textos esperados
    $k = str_replace(['Vista al oc ano', 'Balcon', 'Balcn', 'oc ano'], ['Vista al oceano', 'Balcon', 'Balcon', 'oceano'], $k);

    $allowed = ['Interno', 'Vista al oceano', 'Balcon', 'Suite'];
    if (in_array($k, $allowed, true)) {
      $cleaned[$k] = $value;
    }
  }
  return $cleaned;
}

function parse_cruise_text(string $text): array {
  $clean = normalize_text($text);

  // Buscar fecha (después de "Fecha de navegacion:")
  $fecha = null;
  if (preg_match('/Fecha de navegaci.on:\s*([^B]*)/iu', $clean, $m)) {
    $fecha = trim($m[1]);
  }

  // Buscar puertos
  $puertos = null;
  if (preg_match('/Puertos:\s*(.+)/iu', $clean, $m)) {
    $puertos = trim($m[1]);
  }

  return [
    'fecha' => $fecha,
    'puertos' => $puertos,
  ];
}

function http_get(string $url): string {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; CruiseTracker/1.0; +https://example.com)'
  ]);
  $data = curl_exec($ch);
  if ($data === false) {
    $err = curl_error($ch);
    curl_close($ch);
    throw new RuntimeException('Error HTTP: ' . $err);
  }
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($status < 200 || $status >= 300) {
    throw new RuntimeException('Respuesta HTTP no OK. Codigo: ' . $status);
  }
  return $data;
}

function xpath_query_class(DOMXPath $xp, DOMNode $ctx, string $class): DOMNodeList {
  $expr = ".//*[contains(concat(' ', normalize-space(@class), ' '), ' " . $class . " ')]";
  return $xp->query($expr, $ctx);
}

function scrape_cruises(): array {
  $html = http_get(URL);

  libxml_use_internal_errors(true);
  $doc = new DOMDocument();
  $doc->loadHTML($html);
  libxml_clear_errors();

  $xpath = new DOMXPath($doc);

  $cruises = [];
  // Seleccionar contenedores (aunque el HTML use el mismo id repetido)
  $containers = $xpath->query("//*[@id='formattedResults']");
  foreach ($containers as $el) {
    // Texto del bloque
    $textNode = $xpath->query(".//*[@id='formattedResultsText']", $el)->item(0);
    $rawText = $textNode ? trim($textNode->textContent) : '';
    $parsed = parse_cruise_text($rawText);

    // Precios
    $prices = [];
    $boxes = xpath_query_class($xpath, $el, 'changedRowBecauseOfBackend');
    foreach ($boxes as $box) {
      $typeNode = $xpath->query(".//*[@id='hoverPricingLeft']", $box)->item(0);
      $priceNode = $xpath->query(".//*[@id='hoverPricingRight']", $box)->item(0);

      $type = $typeNode ? trim($typeNode->textContent) : '';
      $priceText = $priceNode ? trim($priceNode->textContent) : '';

      if ($type !== '') {
        // Limpiar número (mantener dígitos, coma, punto)
        $num = preg_replace('/[^0-9,\.]/', '', $priceText);
        $num = str_replace(',', '.', $num);
        $price = (float)$num;
        $prices[$type] = $price;
      }
    }

    $prices = clean_prices($prices);
    $cruises[] = [
      'text' => $parsed,
      'prices' => $prices,
    ];
  }

  return $cruises;
}

function ensure_dir(string $filePath): void {
  $dir = dirname($filePath);
  if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
  }
}

function save_history(array $data): void {
  ensure_dir(HISTORY_FILE);

  $history = [];
  if (is_file(HISTORY_FILE)) {
    $json = file_get_contents(HISTORY_FILE);
    $decoded = json_decode($json, true);
    if (is_array($decoded)) {
      $history = $decoded;
    }
  }

  $entry = [
    'date' => gmdate('c'), // ISO8601 en UTC
    'cruises' => $data,
  ];

  $history[] = $entry;
  file_put_contents(HISTORY_FILE, json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function track(): array {
  $cruises = scrape_cruises();
  if (count($cruises) === 0) {
    return [];
  }

  // Guardar historial
  save_history($cruises);
  return $cruises;
}

// Si se ejecuta directamente desde CLI (cron)
if (php_sapi_name() === 'cli') {
  fwrite(STDOUT, "\n==== Tracker de Cruceros (PHP) ====" . PHP_EOL);
  fwrite(STDOUT, 'Fecha: ' . date('Y-m-d H:i:s') . PHP_EOL);

  try {
    $cruises = track();
    if (count($cruises) > 0) {
      fwrite(STDOUT, 'OK: Se encontraron ' . count($cruises) . ' cruceros' . PHP_EOL);
      fwrite(STDOUT, 'Historial guardado en: ' . HISTORY_FILE . PHP_EOL);
      exit(0);
    } else {
      fwrite(STDOUT, "WARN: No se encontraron cruceros" . PHP_EOL);
      exit(0);
    }
  } catch (Throwable $e) {
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . PHP_EOL);
    exit(1);
  }
}
