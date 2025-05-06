# ESP32 Simulator для Node-RED

Кастомная нода для Node-RED, которая эмулирует многофункциональное устройство на базе ESP32, взаимодействующее через MQTT согласно предоставленной системе команд.

## Особенности

- Полная эмуляция устройства ESP32 с поддержкой MQTT
- Эмуляция всех компонентов:
  - RFID-считыватель
  - Светодиодные кольца и ленты
  - Релейные выходы
  - Цифровые входы
  - GPIO
  - Bluetooth
  - Системные функции
- Настраиваемая генерация событий
- Интеграция с существующими MQTT ноды в Node-RED

## Установка

### Локальная установка

```bash
cd ~/.node-red
npm install <path-to-module>
```

### Установка из npm

```bash
cd ~/.node-red
npm install node-red-contrib-esp32-simulator
```

### Docker

Если используете Node-RED в Docker, добавьте модуль в свой Dockerfile:

```dockerfile
FROM nodered/node-red:latest
RUN npm install node-red-contrib-esp32-simulator
```

## Настройка

1. Добавьте ноду "ESP32 Simulator" на ваш поток
2. Настройте параметры:
   - MQTT брокер
   - Расположение устройства, тип и ID
   - Активные компоненты (RFID, LED, реле и т.д.)
   - Параметры генерации событий

## Использование

### Базовая настройка

1. Настройте подключение к MQTT-брокеру
2. Укажите параметры устройства (местоположение, тип, ID)
3. Включите нужные компоненты

### Генерация событий

Для автоматической генерации событий:

1. Включите опцию "Generate Random Events"
2. Настройте параметры генерации для каждого компонента

### Ручное управление

Вы можете отправлять сообщения на вход ноды для управления эмулятором:

- `msg.topic = "rfid/generate"` - сгенерировать событие считывания RFID
- `msg.topic = "input/generate"` - сгенерировать изменение состояния входа
- `msg.topic = "status/get"` - запросить полный статус устройства

### Топики MQTT

Устройство следует структуре MQTT-топиков:

- `cmnd/<location>/<device_type>/<device_id>/...` - Команды устройству
- `stat/<location>/<device_type>/<device_id>/...` - Статусы/ответы от устройства
- `tele/<location>/<device_type>/<device_id>/...` - Телеметрия и события

## Примеры

### Базовая настройка

```
[{"id":"f6f2187d.f17ca8","type":"esp32-simulator","name":"ESP32 RFID","location":"Office","deviceType":"RFIDRelay","deviceId":"UnitA1","mqttServer":"5b17cb5c.8dbb44","generateRandomEvents":true,"rfidEnabled":true,"rfidAutoGenerate":true,"rfidInterval":"30","ringLedsEnabled":true,"externalLedsEnabled":false,"relaysEnabled":true,"inputsEnabled":true,"inputAutoGenerate":true,"inputInterval":"60","bluetoothEnabled":false,"x":340,"y":220,"wires":[["c1e33c02.2b718"]]},{"id":"5b17cb5c.8dbb44","type":"mqtt-broker","name":"Local Broker","broker":"localhost","port":"1883","clientid":"","usetls":false,"compatmode":false,"keepalive":"60","cleansession":true,"birthTopic":"","birthQos":"0","birthPayload":"","closeTopic":"","closeQos":"0","closePayload":"","willTopic":"","willQos":"0","willPayload":""}]
```

### Полный поток с MQTT

```
[{"id":"f6f2187d.f17ca8","type":"esp32-simulator","name":"ESP32 RFID","location":"Office","deviceType":"RFIDRelay","deviceId":"UnitA1","mqttServer":"5b17cb5c.8dbb44","generateRandomEvents":true,"rfidEnabled":true,"rfidAutoGenerate":true,"rfidInterval":"30","ringLedsEnabled":true,"externalLedsEnabled":false,"relaysEnabled":true,"inputsEnabled":true,"inputAutoGenerate":true,"inputInterval":"60","bluetoothEnabled":false,"x":340,"y":220,"wires":[["c1e33c02.2b718"]]},{"id":"5b17cb5c.8dbb44","type":"mqtt-broker","name":"Local Broker","broker":"localhost","port":"1883","clientid":"","usetls":false,"compatmode":false,"keepalive":"60","cleansession":true,"birthTopic":"","birthQos":"0","birthPayload":"","closeTopic":"","closeQos":"0","closePayload":"","willTopic":"","willQos":"0","willPayload":""},{"id":"c1e33c02.2b718","type":"debug","name":"Events","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":510,"y":220,"wires":[]},{"id":"6e0d45e7.a4fbcc","type":"mqtt in","name":"Listen RFID Events","topic":"tele/Office/RFIDRelay/UnitA1/rfid/tag","qos":"1","datatype":"json","broker":"5b17cb5c.8dbb44","x":370,"y":320,"wires":[["e0766458.d8e1b8"]]},{"id":"e0766458.d8e1b8","type":"debug","name":"RFID Tags","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":570,"y":320,"wires":[]},{"id":"3e3ee0c3.686c1","type":"mqtt out","name":"LED Control","topic":"cmnd/Office/RFIDRelay/UnitA1/led/ring/set","qos":"","retain":"","broker":"5b17cb5c.8dbb44","x":580,"y":380,"wires":[]},{"id":"b0952c0.342e2c","type":"inject","name":"Set LED","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"num\":1,\"color\":[255,0,0],\"br\":128}","payloadType":"json","x":380,"y":380,"wires":[["3e3ee0c3.686c1"]]}]
```

## License

MIT 