# ESP32 Simulator для Node-RED — Полная документация

## Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Компоненты эмулятора](#компоненты-эмулятора)
4. [Структура проекта](#структура-проекта)
5. [Протокол MQTT](#протокол-mqtt)
6. [Установка и запуск](#установка-и-запуск)
7. [Конфигурация](#конфигурация)
8. [API и команды](#api-и-команды)
9. [Интеграция в проекты](#интеграция-в-проекты)
10. [Примеры использования](#примеры-использования)
11. [Разработка и расширение](#разработка-и-расширение)
12. [Часто задаваемые вопросы](#часто-задаваемые-вопросы)

## Обзор проекта

ESP32 Simulator — это кастомная нода для Node-RED, которая эмулирует многофункциональное устройство на базе ESP32 с возможностью взаимодействия через протокол MQTT. Эмулятор реализует поведение устройства, поддерживающего следующие функции:

- RFID-считыватель (13.56 MHz)
- Адресную светодиодную индикацию (кольцо, ~24 LED)
- Внешнюю адресную светодиодную ленту
- Два силовых релейных выхода
- Два цифровых входа
- Wi-Fi и Bluetooth
- Питание от сети, аккумулятора и мониторинг состояния
- GPIO порты для расширения

Эмулятор следует спецификации топиков MQTT и формата payload, описанных в документации системы команд, что позволяет использовать его для разработки и тестирования системы "умного дома" или IoT-проектов без необходимости использования физического оборудования.

## Архитектура

### Общая архитектура

ESP32 Simulator построен как нода Node-RED, которая интегрируется в существующую экосистему и взаимодействует с другими узлами через стандартные механизмы передачи сообщений.

```
┌───────────────────────────────────────────────────────────────────┐
│                     Node-RED Flow Environment                      │
├───────────────────────────────────────────────────────────────────┤
│  ┌────────────┐    ┌─────────────────────┐    ┌────────────────┐  │
│  │            │    │                     │    │                │  │
│  │ MQTT Broker│◄───┤   ESP32 Simulator   │◄───┤  Input Nodes   │  │
│  │    Node    │    │       Node          │    │  (triggers)    │  │
│  │            │    │                     │    │                │  │
│  └─────┬──────┘    └─────────┬───────────┘    └────────────────┘  │
│        │                     │                                     │
│  ┌─────▼──────┐    ┌─────────▼───────────┐                        │
│  │            │    │                     │                        │
│  │ Subscriber │    │    Debug/Output     │                        │
│  │   Nodes    │    │       Nodes         │                        │
│  │            │    │                     │                        │
│  └────────────┘    └─────────────────────┘                        │
└───────────────────────────────────────────────────────────────────┘
```

### Структура коммуникации MQTT

```
┌───────────────────┐        ┌─────────────────┐        ┌───────────────────┐
│                   │        │                 │        │                   │
│   MQTT Publisher  │───────►│  MQTT Broker    │───────►│  ESP32 Simulator  │
│                   │        │                 │        │                   │
└───────────────────┘        └─────────────────┘        └────────┬──────────┘
                                     ▲                           │
                                     │                           │
                                     └───────────────────────────┘
                                       Status/Telemetry Messages
```

## Компоненты эмулятора

### RFID-считыватель
Эмулирует считыватель RFID-меток 13.56 MHz с возможностью:
- Имитации обнаружения тегов с выбранными ID
- Настраиваемой периодичности генерации событий
- Получения и хранения последнего считанного тега

### Светодиодная индикация
Эмулирует:
- Кольцевую адресную светодиодную ленту (по умолчанию 24 LED)
- Внешнюю адресную ленту (настраиваемое количество LED)
- Управление каждым светодиодом отдельно
- Настраиваемые паттерны мигания/анимации

### Релейные выходы
Эмулирует два релейных выхода с функциями:
- Ручное включение/выключение 
- Таймер автоматического выключения (PulseTime)
- Контроль состояния

### Цифровые входы
Эмулирует два цифровых входа с функциями:
- Настройка режимов (INPUT, INPUT_PULLUP)
- Генерация событий изменения состояния
- Настраиваемая периодичность автоматической генерации событий

### Bluetooth
Эмулирует Bluetooth модуль с возможностями:
- Сканирования окружающих устройств
- Имитации обнаружения заданных устройств
- Настройки параметров обнаружения

### Система питания
Эмулирует работу от разных источников питания:
- Сеть (mains)
- Аккумулятор (battery)
- Мониторинг уровня заряда и напряжения
- Телеметрия состояния питания

### GPIO
Эмулирует интерфейс для работы с GPIO портами:
- Настройка режимов работы
- Управление состоянием
- Генерация событий

## Структура проекта

```
node-red-contrib-esp32-simulator/
├── package.json           # Метаданные и зависимости пакета
├── esp32-simulator.js     # Серверная логика ноды
├── esp32-simulator.html   # Пользовательский интерфейс и настройки ноды
├── README.md              # Документация по установке и использованию
├── ESP32-Simulator-PRD.md # PRD-документ с детальным описанием проекта
└── icons/                 # Директория с графическими ресурсами
    └── hardware.svg       # Иконка ноды в палитре Node-RED
```

### Файл esp32-simulator.js
Основной файл JavaScript, реализующий логику эмулятора:
- Настройка и инициализация компонентов
- Обработка входящих сообщений MQTT
- Генерация событий
- Обработка команд управления
- Публикация статусов и телеметрии

### Файл esp32-simulator.html
HTML-файл, определяющий пользовательский интерфейс:
- Конфигурационная форма настроек ноды
- Динамические элементы управления
- Справочная информация
- Определение внешнего вида в редакторе потоков

## Протокол MQTT

### Структура топиков

Эмулятор поддерживает трехуровневую структуру топиков MQTT:

1. **Команды** (`cmnd/`) - отправляются устройству для управления
2. **Статусы** (`stat/`) - ответы от устройства на команды
3. **Телеметрия** (`tele/`) - асинхронные события и периодические данные

Шаблон топика: `<prefix>/<location>/<device_type>/<device_id>/<command_path>`

Примеры:
- `cmnd/Home/RFIDRelay/ESP32Sim1/relay/1/set` - команда реле
- `stat/Home/RFIDRelay/ESP32Sim1/status` - статус устройства
- `tele/Home/RFIDRelay/ESP32Sim1/rfid/tag` - событие обнаружения RFID-тега

### Формат Payload

В зависимости от команды и топика, payload может быть:
- Простой строкой: `ON`, `OFF`, `TOGGLE`
- Числом: `1000` (для таймеров)
- JSON-объектом для сложных команд и данных

## Установка и запуск

### Установка в локальный экземпляр Node-RED

```bash
cd ~/.node-red
npm install <path-to-module>
```

### Установка в Docker-контейнер

#### Метод 1: Монтирование директории
```bash
docker run -d -p 1880:1880 -v "C:/path/to/project:/data/node_modules/node-red-contrib-esp32-simulator" --name mynodered --network iot nodered/node-red
```

#### Метод 2: Создание собственного образа
Создайте Dockerfile:
```dockerfile
FROM nodered/node-red:latest
WORKDIR /tmp/esp32
COPY package.json esp32-simulator.js esp32-simulator.html README.md ./
COPY icons ./icons
RUN mkdir -p /tmp/node_modules/node-red-contrib-esp32-simulator && \
    cp -R ./* /tmp/node_modules/node-red-contrib-esp32-simulator/ && \
    chown -R node-red:node-red /tmp/node_modules
USER node-red
RUN mkdir -p /data/node_modules && \
    cp -R /tmp/node_modules/* /data/node_modules/
```

Сборка и запуск:
```bash
docker build -t mynodered-with-esp32sim .
docker run -d -p 1880:1880 --name mynodered-esp32 --network iot mynodered-with-esp32sim
```

## Конфигурация

### Базовые настройки

- **Name** - имя ноды в потоке
- **MQTT Broker** - брокер для соединения
- **Location** - расположение устройства в топике
- **Device Type** - тип устройства в топике
- **Device ID** - идентификатор устройства в топике

### Настройки компонентов

#### RFID
- **Enable RFID** - включение/выключение функции RFID
- **Auto Generate** - автоматическая генерация событий считывания
- **Interval (s)** - интервал между генерациями в секундах
- **Available Tags** - список доступных RFID-тегов для генерации

#### LED Ring
- **Enable Ring LEDs** - включение/выключение кольцевой подсветки
- **LED Count** - количество светодиодов в кольце

#### External LEDs
- **Enable External LEDs** - включение/выключение внешней ленты
- **LED Count** - количество светодиодов во внешней ленте

#### Relays
- **Enable Relays** - включение/выключение функции реле
- **Relay Count** - количество реле (1 или 2)

#### Inputs
- **Enable Inputs** - включение/выключение цифровых входов
- **Input Count** - количество входов (1 или 2)
- **Auto Change** - автоматическая генерация изменений состояния
- **Interval (s)** - интервал между изменениями в секундах

#### Bluetooth
- **Enable Bluetooth** - включение/выключение функции Bluetooth
- **Auto Scan** - автоматическое сканирование
- **Simulated Devices** - список эмулируемых Bluetooth-устройств

## API и команды

### RFID
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Считана метка | tele | rfid/tag | `{"tag": "04FF1A", "timestamp": 1678886400123}` |
| Запрос последней метки | cmnd | rfid/last/get | (пустой) |
| Статус последней метки | stat | rfid/last | `{"tag": "04FF1A", "timestamp": 1678886400123}` |

### LED
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Установить цвет/яркость | cmnd | led/ring/set | `{"num":4, "color":[0,255,0], "br":128}` |
| Включить паттерн | cmnd | led/ring/pattern | `{"name":"rainbow", "speed":50, "brightness":200}` |
| Запрос состояния | cmnd | led/ring/get | (пустой) |
| Статус состояния | stat | led/ring/state | `{"mode":"pattern", "name":"rainbow", ...}` |

### Реле
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Управление реле | cmnd | relay/1/set | `ON`, `OFF`, `TOGGLE` |
| Управление группой реле | cmnd | relay/set | `{"relay1":"ON", "relay2":"OFF"}` |
| PulseTime для реле | cmnd | relay/1/pulsetime | `1000` (мс) |
| Запрос состояния | cmnd | relay/get | (пустой) |
| Статус реле | stat | relay | `{"relay1":{"state":"ON", "pulsetime_ms":0}, ...}` |

### Входы
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Изменение входа | tele | input | `{"input1":{"state":1, "timestamp":...}}` |
| Запрос состояния | cmnd | input/get | (пустой) |
| Статус входов | stat | input | `{"input1":{"state":1}, "input2":{"state":0}}` |

### Bluetooth
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Сканирование BLE | cmnd | bt/scan | `{"duration_ms":10000}` |
| Статус сканирования | stat | bt/status | `{"scanning":true}` |
| Обнаружено устройство | tele | bt/device | `{"mac":"AA:BB:CC:DD:EE:FF", "rssi":-70, "name":"TestDevice"}` |

### Система
| Событие/Действие | Тип топика | Путь топика | Пример Payload |
|------------------|------------|-------------|----------------|
| Запрос статуса | cmnd | status | (пустой) |
| Полный статус | stat | status | См. документацию |
| Перезагрузка | cmnd | reboot | (пустой) |
| Телеметрия питания | tele | power | `{"source":"battery", "voltage":3.8, "level_percent":70}` |

## Интеграция в проекты

### Подключение к Node-RED

1. Добавьте ноду ESP32 Simulator на ваш поток
2. Настройте MQTT брокер
3. Задайте идентификаторы устройства (Location, Type, ID)
4. Включите нужные компоненты
5. Соедините ноду с нужными входами/выходами

### Работа с MQTT

#### Отправка команд
```
[{"id":"f6f2187d.f17ca8","type":"mqtt out","name":"RFID Command","topic":"cmnd/Home/RFIDRelay/ESP32Sim1/relay/1/set","payload":"ON","qos":"","retain":"","broker":"5b17cb5c.8dbb44","x":370,"y":120,"wires":[]}]
```

#### Прием событий
```
[{"id":"6e0d45e7.a4fbcc","type":"mqtt in","name":"RFID Events","topic":"tele/Home/RFIDRelay/ESP32Sim1/rfid/tag","qos":"1","datatype":"json","broker":"5b17cb5c.8dbb44","x":370,"y":220,"wires":[["e0766458.d8e1b8"]]}]
```

## Примеры использования

### Полный поток с обработкой RFID событий

```json
[{"id":"f6f2187d.f17ca8","type":"esp32-simulator","name":"ESP32 RFID","location":"Office","deviceType":"RFIDRelay","deviceId":"UnitA1","mqttServer":"5b17cb5c.8dbb44","generateRandomEvents":true,"rfidEnabled":true,"rfidAutoGenerate":true,"rfidInterval":"30","ringLedsEnabled":true,"externalLedsEnabled":false,"relaysEnabled":true,"inputsEnabled":true,"inputAutoGenerate":true,"inputInterval":"60","bluetoothEnabled":false,"x":340,"y":220,"wires":[["c1e33c02.2b718"]]},{"id":"5b17cb5c.8dbb44","type":"mqtt-broker","name":"Local Broker","broker":"localhost","port":"1883","clientid":"","usetls":false,"compatmode":false,"keepalive":"60","cleansession":true,"birthTopic":"","birthQos":"0","birthPayload":"","closeTopic":"","closeQos":"0","closePayload":"","willTopic":"","willQos":"0","willPayload":""},{"id":"c1e33c02.2b718","type":"debug","name":"Events","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":510,"y":220,"wires":[]},{"id":"6e0d45e7.a4fbcc","type":"mqtt in","name":"Listen RFID Events","topic":"tele/Office/RFIDRelay/UnitA1/rfid/tag","qos":"1","datatype":"json","broker":"5b17cb5c.8dbb44","x":370,"y":320,"wires":[["e0766458.d8e1b8"]]},{"id":"e0766458.d8e1b8","type":"debug","name":"RFID Tags","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":570,"y":320,"wires":[]},{"id":"3e3ee0c3.686c1","type":"mqtt out","name":"LED Control","topic":"cmnd/Office/RFIDRelay/UnitA1/led/ring/set","qos":"","retain":"","broker":"5b17cb5c.8dbb44","x":580,"y":380,"wires":[]},{"id":"b0952c0.342e2c","type":"inject","name":"Set LED","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"{\"num\":1,\"color\":[255,0,0],\"br\":128}","payloadType":"json","x":380,"y":380,"wires":[["3e3ee0c3.686c1"]]}]
```

### Пример управления реле по RFID

```json
[{"id":"a1e33c02.2b718","type":"mqtt in","name":"RFID Tag In","topic":"tele/Home/RFIDRelay/ESP32Sim1/rfid/tag","qos":"1","datatype":"json","broker":"5b17cb5c.8dbb44","x":370,"y":120,"wires":[["b2e33c02.2b718"]]},{"id":"b2e33c02.2b718","type":"function","name":"Check Tag","func":"if (msg.payload.tag === \"04FF1A\") {\n    return {payload: \"ON\", topic: \"cmnd/Home/RFIDRelay/ESP32Sim1/relay/1/set\"};\n}\nreturn null;","outputs":1,"noerr":0,"initialize":"","finalize":"","x":520,"y":120,"wires":[["c3e33c02.2b718"]]},{"id":"c3e33c02.2b718","type":"mqtt out","name":"Relay Control","topic":"","qos":"","retain":"","broker":"5b17cb5c.8dbb44","x":670,"y":120,"wires":[]}]
```

## Разработка и расширение

### Добавление новых компонентов

Для добавления нового компонента в эмулятор:

1. Добавьте настройки компонента в `defaults` в файле `esp32-simulator.html`:
   ```javascript
   defaults: {
       // ...существующие настройки...
       myComponentEnabled: { value: true },
       myComponentSetting: { value: "default" }
   }
   ```

2. Добавьте логику компонента в `esp32-simulator.js`:
   ```javascript
   // Инициализация компонента
   node.components.myComponent = {
       enabled: config.myComponentEnabled,
       setting: config.myComponentSetting,
       state: initialState
   };
   
   // Обработчик команд
   const handleMyComponentCommand = (pathParts, payload, qos, retain) => {
       // Реализация обработки команд
   };
   ```

3. Зарегистрируйте обработчик в `processCommand`:
   ```javascript
   switch (mainCommand) {
       // ...существующие обработчики...
       case 'mycomponent':
           handleMyComponentCommand(pathParts.slice(1), payload, qos, retain);
           break;
   }
   ```

### Модификация существующих компонентов

Для изменения поведения существующего компонента:

1. Найдите соответствующий обработчик в `esp32-simulator.js`
2. Измените логику обработки событий или генерации данных
3. При необходимости обновите пользовательский интерфейс в `esp32-simulator.html`

## Часто задаваемые вопросы

### Совместимость

**Q: С какими версиями Node-RED совместим эмулятор?**  
A: Эмулятор совместим с Node-RED версии 1.0 и выше.

**Q: Какие MQTT-брокеры поддерживаются?**  
A: Любые MQTT-брокеры, включая Mosquitto, HiveMQ, Eclipse Mosquitto, EMQ X и др.

### Решение проблем

**Q: Эмулятор не подключается к MQTT брокеру. Что делать?**  
A: Проверьте настройки брокера, убедитесь, что он доступен и разрешает анонимные подключения или указаны правильные учетные данные.

**Q: Не вижу ноду в палитре Node-RED. Как исправить?**  
A: Убедитесь, что нода правильно установлена, проверьте наличие ошибок в логах Node-RED при запуске.

**Q: Как настроить автоматическую генерацию событий?**  
A: Включите опцию "Generate Random Events" в настройках ноды и настройте параметры для каждого компонента (RFID, Input). 