#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// -------------------- User Config --------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char* API_BASE = "https://your-backend-domain.com"; // no trailing slash
const char* DEVICE_ID = "ESP32_001";
const char* DEVICE_ENROLLMENT_KEY = "SET_DEVICE_ENROLLMENT_KEY";

const int ECG_PIN = 34;          // AD8232 analog output pin
const int LO_PLUS_PIN = 26;      // AD8232 LO+ pin (optional)
const int LO_MINUS_PIN = 27;     // AD8232 LO- pin (optional)

const int SAMPLE_RATE = 360;     // Must match backend expectation
const int CHUNK_SIZE = 60;       // Backend requires exactly 60 samples
const int HEARTBEAT_MS = 5000;   // Send heartbeat every 5s
// -----------------------------------------------------

float ecgChunk[CHUNK_SIZE];
int chunkIndex = 0;
unsigned long lastHeartbeat = 0;
unsigned long nextSampleMicros = 0;
String runtimeApiKey = "";

float normalizeSample(int raw) {
  // Convert ADC 0..4095 to approximately -1.0..1.0
  return ((float)raw - 2048.0f) / 2048.0f;
}

bool sensorConnected() {
  pinMode(LO_PLUS_PIN, INPUT);
  pinMode(LO_MINUS_PIN, INPUT);
  int loPlus = digitalRead(LO_PLUS_PIN);
  int loMinus = digitalRead(LO_MINUS_PIN);
  // AD8232 lead-off pins HIGH generally indicate disconnected electrodes
  return !(loPlus == HIGH || loMinus == HIGH);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
  }
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
    return;
  }

  StaticJsonDocument<256> resDoc;
  if (deserializeJson(resDoc, response) == DeserializationError::Ok) {
    const char* apiKey = resDoc["api_key"] | "";
    if (strlen(apiKey) > 0) {
      runtimeApiKey = String(apiKey);
    }
  }
}

void sendSensorChunk() {
  if (!sensorConnected() || runtimeApiKey.length() == 0) {
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
}

void setup() {
  analogReadResolution(12);
  connectWifi();
  nextSampleMicros = micros();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
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
    ecgChunk[chunkIndex++] = normalizeSample(raw);
    nextSampleMicros += sampleIntervalUs;

    if (chunkIndex >= CHUNK_SIZE) {
      sendSensorChunk();
      chunkIndex = 0;
    }
  }
}
