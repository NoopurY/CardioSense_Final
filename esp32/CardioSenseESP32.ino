#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// -------------------- User Config --------------------
const char* WIFI_SSID = "NOOPUR Y.";
const char* WIFI_PASS = "1206NOOPUR";

const char* API_BASE = "https://cardio-sense-final.vercel.app"; // no trailing slash
const char* DEVICE_ID = "ESP32_001";
const char* DEVICE_ENROLLMENT_KEY = "cardiosense-enroll-esp32-001-2026";

const int ECG_PIN = 34;          // AD8232 analog output pin
const int LO_PLUS_PIN = 26;      // AD8232 LO+ pin (optional)
const int LO_MINUS_PIN = 27;     // AD8232 LO- pin (optional)

const int SAMPLE_RATE = 360;     // Must match backend expectation
const int CHUNK_SIZE = 60;       // Backend requires exactly 60 samples
const int HEARTBEAT_MS = 5000;   // Send heartbeat every 5s
const bool ENABLE_SERIAL_DEBUG = true;
const int DEBUG_PRINT_MS = 1500;
const int WIFI_RETRY_DELAY_MS = 400;
const int WIFI_CONNECT_TIMEOUT_MS = 15000;
const int WIFI_RECONNECT_INTERVAL_MS = 3000;
const int NO_API_KEY_LOG_MS = 5000;
const float ECG_BASELINE_ALPHA = 0.008f;
const float ECG_GAIN = 4.0f;
const float ECG_CLIP = 1.8f;
// -----------------------------------------------------

float ecgChunk[CHUNK_SIZE];
int chunkIndex = 0;
unsigned long lastHeartbeat = 0;
unsigned long nextSampleMicros = 0;
unsigned long lastDebugPrint = 0;
unsigned long lastWifiReconnectAttempt = 0;
unsigned long lastNoApiKeyLog = 0;
unsigned long lastUploadOkLog = 0;
unsigned long uploadOkCount = 0;
String runtimeApiKey = "";
bool baselineInitialized = false;
float baselineEma = 0.0f;

bool hasValidEnrollmentKey() {
  return String(DEVICE_ENROLLMENT_KEY) != "SET_DEVICE_ENROLLMENT_KEY";
}

float normalizeSample(int raw) {
  // Keep waveform real by only removing DC baseline and applying linear gain.
  if (!baselineInitialized) {
    baselineEma = (float)raw;
    baselineInitialized = true;
  }

  baselineEma += ECG_BASELINE_ALPHA * ((float)raw - baselineEma);
  float centered = ((float)raw - baselineEma) / 2048.0f;
  float amplified = centered * ECG_GAIN;

  if (amplified > ECG_CLIP) return ECG_CLIP;
  if (amplified < -ECG_CLIP) return -ECG_CLIP;
  return amplified;
}

bool sensorConnected() {
  int loPlus = digitalRead(LO_PLUS_PIN);
  int loMinus = digitalRead(LO_MINUS_PIN);
  // AD8232 lead-off pins HIGH generally indicate disconnected electrodes
  return !(loPlus == HIGH || loMinus == HIGH);
}

void debugPrintSample(int raw, float normalized) {
  if (!ENABLE_SERIAL_DEBUG) {
    return;
  }

  unsigned long nowMs = millis();
  if (nowMs - lastDebugPrint < DEBUG_PRINT_MS) {
    return;
  }

  lastDebugPrint = nowMs;
  int loPlus = digitalRead(LO_PLUS_PIN);
  int loMinus = digitalRead(LO_MINUS_PIN);
  Serial.print("raw=");
  Serial.print(raw);
  Serial.print(" normalized=");
  Serial.print(normalized, 4);
  Serial.print(" LO+=");
  Serial.print(loPlus);
  Serial.print(" LO-=");
  Serial.print(loMinus);
  Serial.print(" wifi=");
  Serial.println(WiFi.status() == WL_CONNECTED ? "connected" : "disconnected");
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < WIFI_CONNECT_TIMEOUT_MS) {
    if (ENABLE_SERIAL_DEBUG) {
      Serial.println("Connecting to WiFi...");
    }
    delay(WIFI_RETRY_DELAY_MS);
  }

  bool connected = WiFi.status() == WL_CONNECTED;
  if (ENABLE_SERIAL_DEBUG) {
    Serial.println(connected ? "WiFi connected" : "WiFi connect timeout");
  }
  return connected;
}

bool postJson(const String& url, const String& payload, String* responseBody = nullptr, int* statusCode = nullptr) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST((uint8_t*)payload.c_str(), payload.length());
  if (responseBody) {
    *responseBody = http.getString();
  }
  if (statusCode) *statusCode = code;
  http.end();
  return code >= 200 && code < 300;
}

void sendHeartbeat() {
  if (runtimeApiKey.length() == 0 && !hasValidEnrollmentKey()) {
    if (ENABLE_SERIAL_DEBUG) {
      Serial.println("Enrollment key is still placeholder. Set DEVICE_ENROLLMENT_KEY first.");
    }
    return;
  }

  StaticJsonDocument<384> doc;
  doc["device_id"] = DEVICE_ID;
  if (runtimeApiKey.length() > 0) {
    doc["api_key"] = runtimeApiKey;
  } else {
    doc["enrollment_key"] = DEVICE_ENROLLMENT_KEY;
  }
  bool connected = sensorConnected();
  doc["sensor_connected"] = connected;
  doc["sampling_rate"] = SAMPLE_RATE;
  doc["signal_strength"] = WiFi.RSSI() > -100 ? (WiFi.RSSI() + 100) : 0; // rough 0..60+
  doc["battery"] = 100; // replace with real battery telemetry if available

  String body;
  serializeJson(doc, body);

  String response;
  int code = 0;
  if (!postJson(String(API_BASE) + "/api/devices/heartbeat", body, &response, &code)) {
    if (ENABLE_SERIAL_DEBUG) {
      Serial.print("Heartbeat failed, HTTP ");
      Serial.println(code);
      if (response.length() > 0) {
        Serial.print("Heartbeat error body: ");
        Serial.println(response);
      }
    }
    return;
  }

  if (ENABLE_SERIAL_DEBUG) {
    Serial.print("Heartbeat OK, HTTP ");
    Serial.println(code);
  }

  StaticJsonDocument<256> resDoc;
  DeserializationError parseErr = deserializeJson(resDoc, response);
  if (parseErr == DeserializationError::Ok) {
    const char* apiKey = resDoc["api_key"] | "";
    if (strlen(apiKey) > 0) {
      runtimeApiKey = String(apiKey);
      if (ENABLE_SERIAL_DEBUG) {
        Serial.println("api_key received from heartbeat.");
      }
    } else if (ENABLE_SERIAL_DEBUG) {
      Serial.println("Heartbeat response has no api_key field.");
    }
  } else if (ENABLE_SERIAL_DEBUG) {
    Serial.print("Heartbeat JSON parse error: ");
    Serial.println(parseErr.c_str());
  }
}

void sendSensorChunk() {
  if (!sensorConnected() || runtimeApiKey.length() == 0) {
    if (ENABLE_SERIAL_DEBUG && runtimeApiKey.length() == 0 && millis() - lastNoApiKeyLog >= NO_API_KEY_LOG_MS) {
      Serial.println("Skipping chunk: api_key not available yet");
      lastNoApiKeyLog = millis();
    }
    return;
  }

  StaticJsonDocument<4096> doc;
  doc["device_id"] = DEVICE_ID;
  doc["api_key"] = runtimeApiKey;
  JsonArray signal = doc.createNestedArray("signal");

  for (int i = 0; i < CHUNK_SIZE; i++) {
    signal.add(ecgChunk[i]);
  }

  String body;
  serializeJson(doc, body);

  int code = 0;
  postJson(String(API_BASE) + "/api/sensor/data", body, nullptr, &code);
  if (code >= 200 && code < 300) {
    uploadOkCount += 1;
    if (ENABLE_SERIAL_DEBUG && millis() - lastUploadOkLog >= 5000) {
      Serial.print("Sensor upload OK count=");
      Serial.println(uploadOkCount);
      lastUploadOkLog = millis();
    }
  }
  if (ENABLE_SERIAL_DEBUG && (code < 200 || code >= 300)) {
    Serial.print("Sensor upload failed, HTTP ");
    Serial.println(code);
  }
}

void setup() {
  if (ENABLE_SERIAL_DEBUG) {
    Serial.begin(115200);
    delay(500);
    Serial.println("CardioSense ESP32 starting...");
    if (!hasValidEnrollmentKey()) {
      Serial.println("Set DEVICE_ENROLLMENT_KEY. Current value is placeholder.");
    }
  }

  pinMode(LO_PLUS_PIN, INPUT);
  pinMode(LO_MINUS_PIN, INPUT);
  analogReadResolution(12);
  connectWifi();
  nextSampleMicros = micros();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long nowMs = millis();
    if (nowMs - lastWifiReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
      connectWifi();
      lastWifiReconnectAttempt = nowMs;
    }
    delay(10);
    return;
  }

  unsigned long nowMs = millis();
  if (nowMs - lastHeartbeat >= HEARTBEAT_MS) {
    sendHeartbeat();
    lastHeartbeat = nowMs;
  }

  unsigned long nowUs = micros();
  unsigned long sampleIntervalUs = 1000000UL / SAMPLE_RATE;

  if ((long)(nowUs - nextSampleMicros) >= 0) {
    int raw = analogRead(ECG_PIN);
    float normalized = normalizeSample(raw);
    ecgChunk[chunkIndex++] = normalized;
    debugPrintSample(raw, normalized);
    nextSampleMicros += sampleIntervalUs;

    if (chunkIndex >= CHUNK_SIZE) {
      sendSensorChunk();
      chunkIndex = 0;
    }
  }
}
