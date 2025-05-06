module.exports = function(RED) {
    "use strict";
    
    // Constructor for ESP32 simulator node
    function ESP32SimulatorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Store configuration
        node.location = config.location;
        node.deviceType = config.deviceType;
        node.deviceId = config.deviceId;
        node.generateRandomEvents = config.generateRandomEvents;
        
        // MQTT Connection - using the broker config node
        node.mqttBroker = RED.nodes.getNode(config.mqttServer);
        
        // Store component configurations
        node.components = {
            rfid: {
                enabled: config.rfidEnabled,
                autoGenerate: config.rfidAutoGenerate,
                interval: (parseInt(config.rfidInterval) || 30) * 1000, // convert to ms, default 30s
                tags: JSON.parse(config.rfidTags || '["04FF1A", "ABCDEF", "123456"]'),
                lastTag: null,
                timer: null
            },
            ringLeds: {
                enabled: config.ringLedsEnabled,
                count: config.ringLedsCount,
                state: Array(parseInt(config.ringLedsCount) || 24).fill([0,0,0]),
                mode: "static",
                pattern: null
            },
            externalLeds: {
                enabled: config.externalLedsEnabled,
                count: config.externalLedsCount,
                state: Array(parseInt(config.externalLedsCount) || 30).fill([0,0,0]),
                mode: "static",
                pattern: null
            },
            relays: {
                enabled: config.relaysEnabled,
                count: config.relayCount,
                state: Array(parseInt(config.relayCount) || 2).fill(false),
                pulseTimes: Array(parseInt(config.relayCount) || 2).fill(0),
                pulseTimers: Array(parseInt(config.relayCount) || 2).fill(null)
            },
            inputs: {
                enabled: config.inputsEnabled,
                count: config.inputCount,
                state: Array(parseInt(config.inputCount) || 2).fill(0),
                autoChange: config.inputAutoGenerate,
                interval: (parseInt(config.inputInterval) || 60) * 1000, // convert to ms, default 60s
                timer: null
            },
            bluetooth: {
                enabled: config.bluetoothEnabled,
                autoScan: config.bluetoothAutoScan,
                devices: JSON.parse(config.bluetoothDevices || '[{"mac": "AA:BB:CC:DD:EE:FF", "name": "TestDevice", "rssi": -70}]'),
                scanning: false
            },
            power: {
                source: "mains", // mains, battery
                voltage: 5.0,
                batteryLevel: 100,
                charging: false
            }
        };
        
        // Status object to track overall state
        node.deviceStatus = {
            online: true,
            uptime: 0,
            startTime: Date.now(),
            lastUpdate: Date.now(),
            ip: "192.168.1.100",
            mac: "AA:BB:CC:11:22:33",
            rssi: -65,
            features: ["rfid"]
        };
        
        // MQTT Topic Prefixes
        node.mqttTopics = {
            command: `cmnd/${node.location}/${node.deviceType}/${node.deviceId}`,
            status: `stat/${node.location}/${node.deviceType}/${node.deviceId}`,
            telemetry: `tele/${node.location}/${node.deviceType}/${node.deviceId}`
        };
        
        // Update node status
        const updateStatus = () => {
            if (node.deviceStatus.online) {
                let statusText = `Online - ${node.mqttTopics.command}/#`;
                node.status({ fill: "green", shape: "dot", text: statusText });
            } else {
                node.status({ fill: "red", shape: "ring", text: "Offline" });
            }
        };
        
        // Start timers for auto-generating events
        const startEventGenerators = () => {
            // Only start if enabled globally and for specific component
            if (!node.generateRandomEvents) return;
            
            // RFID auto-generation
            if (node.components.rfid.enabled && node.components.rfid.autoGenerate) {
                node.log(`Starting RFID auto-generation with interval ${node.components.rfid.interval}ms`);
                node.components.rfid.timer = setInterval(() => {
                    generateRfidEvent();
                }, node.components.rfid.interval);
            }
            
            // Input state changes auto-generation
            if (node.components.inputs.enabled && node.components.inputs.autoChange) {
                node.log(`Starting input auto-generation with interval ${node.components.inputs.interval}ms`);
                node.components.inputs.timer = setInterval(() => {
                    generateInputEvent();
                }, node.components.inputs.interval);
            }
            
            // Periodic telemetry events
            node.telemetryTimer = setInterval(() => {
                publishPowerTelemetry();
            }, 60000); // every minute
        };
        
        // Stop all timers
        const stopEventGenerators = () => {
            if (node.components.rfid.timer) {
                clearInterval(node.components.rfid.timer);
                node.components.rfid.timer = null;
            }
            
            if (node.components.inputs.timer) {
                clearInterval(node.components.inputs.timer);
                node.components.inputs.timer = null;
            }
            
            if (node.telemetryTimer) {
                clearInterval(node.telemetryTimer);
                node.telemetryTimer = null;
            }
            
            // Clear pulse timers for relays
            node.components.relays.pulseTimers.forEach((timer, index) => {
                if (timer) {
                    clearTimeout(timer);
                    node.components.relays.pulseTimers[index] = null;
                }
            });
        };
        
        // Generate RFID tag detection event
        const generateRfidEvent = () => {
            const tags = node.components.rfid.tags;
            if (!tags || tags.length === 0) return;
            
            // Select random tag
            const randomIndex = Math.floor(Math.random() * tags.length);
            const tag = tags[randomIndex];
            
            // Store last tag
            node.components.rfid.lastTag = {
                tag: tag,
                timestamp: Date.now()
            };
            
            // Publish RFID event
            publishMqttMessage(
                `${node.mqttTopics.telemetry}/rfid/tag`, 
                node.components.rfid.lastTag
            );
            
            // Send to debug tab and outputs
            const msg = {
                topic: `${node.mqttTopics.telemetry}/rfid/tag`,
                payload: node.components.rfid.lastTag
            };
            node.send(msg);
            
            node.log(`Generated RFID event: ${tag}`);
        };
        
        // Generate input state change event
        const generateInputEvent = () => {
            if (!node.components.inputs.enabled) return;
            
            // Select random input
            const inputIndex = Math.floor(Math.random() * node.components.inputs.count);
            
            // Toggle state
            node.components.inputs.state[inputIndex] = node.components.inputs.state[inputIndex] ? 0 : 1;
            
            const inputEvent = {
                [`input${inputIndex + 1}`]: {
                    state: node.components.inputs.state[inputIndex],
                    timestamp: Date.now()
                }
            };
            
            // Publish input event
            publishMqttMessage(
                `${node.mqttTopics.telemetry}/input`, 
                inputEvent
            );
            
            // Send to outputs
            const msg = {
                topic: `${node.mqttTopics.telemetry}/input`,
                payload: inputEvent
            };
            node.send(msg);
            
            node.log(`Generated Input event: input${inputIndex + 1} = ${node.components.inputs.state[inputIndex]}`);
        };
        
        // Publish power telemetry
        const publishPowerTelemetry = () => {
            const powerTelemetry = {
                source: node.components.power.source,
                voltage: node.components.power.voltage,
                level_percent: node.components.power.batteryLevel,
                charging: node.components.power.charging
            };
            
            // Publish telemetry
            publishMqttMessage(
                `${node.mqttTopics.telemetry}/power`, 
                powerTelemetry
            );
            
            // Update uptime
            node.deviceStatus.uptime = Math.floor((Date.now() - node.deviceStatus.startTime) / 1000);
            node.deviceStatus.lastUpdate = Date.now();
        };
        
        // Helper function to publish MQTT message
        const publishMqttMessage = (topic, payload, options = {}) => {
            if (!node.mqttBroker || !node.mqttBroker.client || !node.mqttBroker.client.connected) {
                node.warn("MQTT broker not connected");
                return;
            }
            
            let payloadStr = typeof payload === 'object' ? 
                JSON.stringify(payload) : 
                payload.toString();
                
            const defaultOptions = { 
                qos: 1, 
                retain: false
            };
            
            const mqttOptions = { ...defaultOptions, ...options };
            
            node.mqttBroker.client.publish(topic, payloadStr, mqttOptions, (err) => {
                if (err) {
                    node.error(`MQTT publish error: ${err}`, { topic, payload });
                }
            });
        };
        
        // Handle incoming MQTT messages
        const handleMqttMessage = (topic, payload, packet) => {
            // Extract command path
            if (!topic.startsWith(node.mqttTopics.command + '/')) {
                return; // Not for this device
            }
            
            const commandPath = topic.substring(node.mqttTopics.command.length + 1);
            
            // Parse JSON payload if possible
            let payloadObj = payload;
            if (typeof payload === 'string') {
                try {
                    payloadObj = JSON.parse(payload);
                } catch (e) {
                    // Not JSON, use as-is (string commands like ON/OFF)
                }
            }
            
            node.log(`Received command: ${commandPath} with payload: ${payload}`);
            
            // Process command based on path
            processCommand(commandPath, payloadObj, packet.qos, packet.retain);
            
            // Send to outputs for debugging or further processing
            const msg = { topic: topic, payload: payloadObj, qos: packet.qos, retain: packet.retain };
            node.send(msg);
        };
        
        // Handle incoming commands
        const processCommand = (commandPath, payload, qos, retain) => {
            const pathParts = commandPath.split('/');
            const mainCommand = pathParts[0];
            
            switch (mainCommand) {
                case 'rfid':
                    handleRfidCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'led':
                    handleLedCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'relay':
                    handleRelayCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'input':
                    handleInputCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'bt':
                    handleBluetoothCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'status':
                    // Return full device status
                    publishFullStatus();
                    break;
                    
                case 'reboot':
                    simulateReboot();
                    break;
                    
                case 'config':
                    handleConfigCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                case 'gpio':
                    handleGpioCommand(pathParts.slice(1), payload, qos, retain);
                    break;
                    
                default:
                    node.warn(`Unknown command: ${mainCommand}`);
            }
        };
        
        // RFID Command Handler
        const handleRfidCommand = (pathParts, payload, qos, retain) => {
            if (!node.components.rfid.enabled) {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: "RFID functionality not enabled" });
            }
            
            if (pathParts[0] === 'last' && pathParts[1] === 'get') {
                // Return last seen RFID tag
                publishMqttMessage(
                    `${node.mqttTopics.status}/rfid/last`, 
                    node.components.rfid.lastTag || null,
                    { qos, retain }
                );
            }
        };
        
        // LED Command Handler
        const handleLedCommand = (pathParts, payload, qos, retain) => {
            const ledType = pathParts[0]; // ring or external
            const action = pathParts[1]; // set, pattern, get
            
            let component;
            if (ledType === 'ring') {
                if (!node.components.ringLeds.enabled) {
                    return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                        { message: "Ring LED functionality not enabled" });
                }
                component = node.components.ringLeds;
            } else if (ledType === 'external') {
                if (!node.components.externalLeds.enabled) {
                    return publishMqttMessage(`${node.mqttTopics.status}/error`,
                        { message: "External LED functionality not enabled" });
                }
                component = node.components.externalLeds;
            } else {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: "Unknown LED type" });
            }
            
            switch (action) {
                case 'set':
                    // Handle set
                    if (payload.num !== undefined && payload.color) {
                        const num = parseInt(payload.num);
                        if (num >= 0 && num < component.count) {
                            component.state[num] = payload.color;
                            component.mode = "static";
                        }
                    }
                    break;
                
                case 'pattern':
                    // Handle pattern
                    if (payload && payload.name) {
                        component.mode = "pattern";
                        component.pattern = payload;
                    }
                    break;
                
                case 'get':
                    // Return state
                    publishLedState(ledType, component);
                    break;
            }
            
            // Always publish state after any changes
            if (action === 'set' || action === 'pattern') {
                publishLedState(ledType, component);
            }
        };
        
        // Helper for LED state
        const publishLedState = (ledType, component) => {
            const state = {
                mode: component.mode,
                count: component.count
            };
            
            if (component.mode === "pattern" && component.pattern) {
                state.pattern = component.pattern;
            } else {
                state.state = component.state;
            }
            
            publishMqttMessage(
                `${node.mqttTopics.status}/led/${ledType}/state`, 
                state,
                { qos: 1, retain: true }
            );
        };
        
        // Relay Command Handler
        const handleRelayCommand = (pathParts, payload, qos, retain) => {
            if (!node.components.relays.enabled) {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: "Relay functionality not enabled" });
            }
            
            // Handle single relay command: relay/1/set ON
            if (pathParts.length >= 2 && pathParts[1] === 'set') {
                const relayNum = parseInt(pathParts[0]);
                if (isNaN(relayNum) || relayNum < 1 || relayNum > node.components.relays.count) {
                    return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                        { message: `Invalid relay number: ${pathParts[0]}` });
                }
                
                const index = relayNum - 1;
                
                // Handle ON, OFF, TOGGLE
                if (payload === 'ON') {
                    node.components.relays.state[index] = true;
                } else if (payload === 'OFF') {
                    node.components.relays.state[index] = false;
                } else if (payload === 'TOGGLE') {
                    node.components.relays.state[index] = !node.components.relays.state[index];
                }
                
                // Cancel existing pulse timer if any
                if (node.components.relays.pulseTimers[index]) {
                    clearTimeout(node.components.relays.pulseTimers[index]);
                    node.components.relays.pulseTimers[index] = null;
                }
                
                // Apply pulse timer if set
                if (node.components.relays.pulseTimes[index] > 0 && node.components.relays.state[index]) {
                    node.components.relays.pulseTimers[index] = setTimeout(() => {
                        node.components.relays.state[index] = false;
                        node.components.relays.pulseTimers[index] = null;
                        publishRelayState();
                    }, node.components.relays.pulseTimes[index]);
                }
            }
            // Handle pulsetime: relay/1/pulsetime 1000
            else if (pathParts.length >= 2 && pathParts[1] === 'pulsetime') {
                const relayNum = parseInt(pathParts[0]);
                if (isNaN(relayNum) || relayNum < 1 || relayNum > node.components.relays.count) {
                    return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                        { message: `Invalid relay number: ${pathParts[0]}` });
                }
                
                const index = relayNum - 1;
                const pulseTime = parseInt(payload);
                
                if (!isNaN(pulseTime) && pulseTime >= 0) {
                    node.components.relays.pulseTimes[index] = pulseTime;
                }
            }
            // Handle group command: relay/set
            else if (pathParts.length === 1 && pathParts[0] === 'set' && typeof payload === 'object') {
                for (let i = 1; i <= node.components.relays.count; i++) {
                    const relayKey = `relay${i}`;
                    if (payload[relayKey] !== undefined) {
                        const index = i - 1;
                        if (payload[relayKey] === 'ON') {
                            node.components.relays.state[index] = true;
                        } else if (payload[relayKey] === 'OFF') {
                            node.components.relays.state[index] = false;
                        } else if (payload[relayKey] === 'TOGGLE') {
                            node.components.relays.state[index] = !node.components.relays.state[index];
                        }
                    }
                }
            }
            // Handle get state: relay/get
            else if (pathParts.length === 1 && pathParts[0] === 'get') {
                // Just publish the state
            }
            
            // Publish relay state
            publishRelayState();
        };
        
        // Helper for Relay state
        const publishRelayState = () => {
            const state = {};
            
            for (let i = 1; i <= node.components.relays.count; i++) {
                const index = i - 1;
                state[`relay${i}`] = {
                    state: node.components.relays.state[index] ? "ON" : "OFF",
                    pulsetime_ms: node.components.relays.pulseTimes[index]
                };
            }
            
            publishMqttMessage(
                `${node.mqttTopics.status}/relay`, 
                state,
                { qos: 1, retain: true }
            );
        };
        
        // Input Command Handler
        const handleInputCommand = (pathParts, payload, qos, retain) => {
            if (!node.components.inputs.enabled) {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: "Input functionality not enabled" });
            }
            
            // Handle get: input/get
            if (pathParts.length === 1 && pathParts[0] === 'get') {
                publishInputState();
            }
            
            // Handle config change
        };
        
        // Helper for Input state
        const publishInputState = () => {
            const state = {};
            
            for (let i = 1; i <= node.components.inputs.count; i++) {
                const index = i - 1;
                state[`input${i}`] = {
                    state: node.components.inputs.state[index]
                };
            }
            
            publishMqttMessage(
                `${node.mqttTopics.status}/input`, 
                state,
                { qos: 1, retain: true }
            );
        };
        
        // Bluetooth Command Handler
        const handleBluetoothCommand = (pathParts, payload, qos, retain) => {
            if (!node.components.bluetooth.enabled) {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: "Bluetooth functionality not enabled" });
            }
            
            // Handle scan: bt/scan
            if (pathParts.length === 1 && pathParts[0] === 'scan') {
                let duration = 10000; // Default 10 seconds
                
                if (typeof payload === 'object' && payload.duration_ms) {
                    duration = payload.duration_ms;
                }
                
                simulateBluetoothScan(duration);
            }
        };
        
        // Simulate Bluetooth scan
        const simulateBluetoothScan = (duration) => {
            if (node.components.bluetooth.scanning) {
                return; // Already scanning
            }
            
            node.components.bluetooth.scanning = true;
            
            // Publish scan start
            publishMqttMessage(
                `${node.mqttTopics.status}/bt/status`, 
                { scanning: true },
                { qos: 1 }
            );
            
            // Simulate device discovery
            const devices = node.components.bluetooth.devices;
            const totalDevices = devices.length;
            
            if (totalDevices > 0) {
                // Calculate interval for discovering devices
                const interval = duration / totalDevices;
                
                devices.forEach((device, index) => {
                    setTimeout(() => {
                        // Clone device object and add timestamp
                        const discoveredDevice = { ...device, timestamp: Date.now() };
                        
                        // Publish discovered device
                        publishMqttMessage(
                            `${node.mqttTopics.telemetry}/bt/device`, 
                            discoveredDevice,
                            { qos: 0 }
                        );
                        
                        // Send to outputs
                        const msg = {
                            topic: `${node.mqttTopics.telemetry}/bt/device`,
                            payload: discoveredDevice
                        };
                        node.send(msg);
                        
                    }, index * interval);
                });
            }
            
            // End scan after duration
            setTimeout(() => {
                node.components.bluetooth.scanning = false;
                
                // Publish scan end
                publishMqttMessage(
                    `${node.mqttTopics.status}/bt/status`, 
                    { scanning: false },
                    { qos: 1 }
                );
                
            }, duration);
        };
        
        // Config Command Handler
        const handleConfigCommand = (pathParts, payload, qos, retain) => {
            // Handle get: config/get
            if (pathParts.length === 1 && pathParts[0] === 'get') {
                publishConfig();
            }
            // Handle set: config (with payload)
            else if (pathParts.length === 0 && typeof payload === 'object') {
                // Update configuration
                if (payload.location) node.location = payload.location;
                if (payload.deviceType) node.deviceType = payload.deviceType;
                if (payload.deviceId) node.deviceId = payload.deviceId;
                
                // Update MQTT topics with new values
                node.mqttTopics = {
                    command: `cmnd/${node.location}/${node.deviceType}/${node.deviceId}`,
                    status: `stat/${node.location}/${node.deviceType}/${node.deviceId}`,
                    telemetry: `tele/${node.location}/${node.deviceType}/${node.deviceId}`
                };
                
                // Update node status display
                updateStatus();
                
                // Publish updated config
                publishConfig();
            }
        };
        
        // Publish config
        const publishConfig = () => {
            const config = {
                location: node.location,
                deviceType: node.deviceType,
                deviceId: node.deviceId,
                components: {
                    rfid: {
                        enabled: node.components.rfid.enabled
                    },
                    ringLeds: {
                        enabled: node.components.ringLeds.enabled,
                        count: node.components.ringLeds.count
                    },
                    externalLeds: {
                        enabled: node.components.externalLeds.enabled,
                        count: node.components.externalLeds.count
                    },
                    relays: {
                        enabled: node.components.relays.enabled,
                        count: node.components.relays.count
                    },
                    inputs: {
                        enabled: node.components.inputs.enabled,
                        count: node.components.inputs.count
                    },
                    bluetooth: {
                        enabled: node.components.bluetooth.enabled
                    }
                }
            };
            
            publishMqttMessage(
                `${node.mqttTopics.status}/config`, 
                config,
                { qos: 1, retain: true }
            );
        };
        
        // GPIO Command Handler
        const handleGpioCommand = (pathParts, payload, qos, retain) => {
            // Not fully implemented - simplified version
            const gpioNumber = parseInt(pathParts[0]);
            if (isNaN(gpioNumber)) {
                return publishMqttMessage(`${node.mqttTopics.status}/error`, 
                    { message: `Invalid GPIO number: ${pathParts[0]}` });
            }
            
            // Just return acknowledgement
            publishMqttMessage(
                `${node.mqttTopics.status}/gpio/${gpioNumber}`,
                { state: 1 },
                { qos: 1 }
            );
        };
        
        // Simulate reboot
        const simulateReboot = () => {
            node.deviceStatus.online = false;
            updateStatus();
            
            publishMqttMessage(
                `${node.mqttTopics.status}/reboot`, 
                { message: "Rebooting", timestamp: Date.now() }
            );
            
            // Simulate going offline
            setTimeout(() => {
                node.deviceStatus.online = true;
                node.deviceStatus.startTime = Date.now();
                node.deviceStatus.uptime = 0;
                updateStatus();
                
                publishMqttMessage(
                    `${node.mqttTopics.status}/boot`, 
                    { message: "Device started", timestamp: Date.now() }
                );
                
                // Publish initial status
                publishFullStatus();
            }, 5000); // 5 second reboot time
        };
        
        // Publish full status
        const publishFullStatus = () => {
            node.deviceStatus.uptime = Math.floor((Date.now() - node.deviceStatus.startTime) / 1000);
            
            const status = {
                timestamp: Date.now(),
                uptime: node.deviceStatus.uptime,
                online: node.deviceStatus.online,
                ip: node.deviceStatus.ip,
                mac: node.deviceStatus.mac,
                rssi: node.deviceStatus.rssi,
                components: {
                    rfid: node.components.rfid.enabled ? {
                        enabled: true,
                        last_tag: node.components.rfid.lastTag
                    } : { enabled: false },
                    leds: {
                        ring: node.components.ringLeds.enabled ? {
                            count: node.components.ringLeds.count,
                            mode: node.components.ringLeds.mode
                        } : { enabled: false },
                        external: node.components.externalLeds.enabled ? {
                            count: node.components.externalLeds.count,
                            mode: node.components.externalLeds.mode
                        } : { enabled: false }
                    },
                    relays: node.components.relays.enabled ? {
                        count: node.components.relays.count,
                        states: node.components.relays.state.map((state, index) => ({
                            relay: index + 1,
                            state: state ? "ON" : "OFF",
                            pulsetime_ms: node.components.relays.pulseTimes[index]
                        }))
                    } : { enabled: false },
                    inputs: node.components.inputs.enabled ? {
                        count: node.components.inputs.count,
                        states: node.components.inputs.state.map((state, index) => ({
                            input: index + 1,
                            state: state
                        }))
                    } : { enabled: false },
                    bluetooth: node.components.bluetooth.enabled ? {
                        enabled: true,
                        scanning: node.components.bluetooth.scanning
                    } : { enabled: false },
                    power: {
                        source: node.components.power.source,
                        voltage: node.components.power.voltage,
                        level_percent: node.components.power.batteryLevel,
                        charging: node.components.power.charging
                    }
                }
            };
            
            publishMqttMessage(
                `${node.mqttTopics.status}/status`, 
                status,
                { qos: 1, retain: true }
            );
        };
        
        // Setup MQTT subscription when broker connects
        if (node.mqttBroker) {
            node.mqttBroker.register(node);
            
            // Handle connection to MQTT broker
            const handleBrokerStatus = function(status) {
                node.log(`MQTT broker status changed to: ${status}`);
                if (status === 'connected') {
                    // Subscribe to device's command topic
                    const topic = `${node.mqttTopics.command}/#`;
                    node.mqttBroker.client.subscribe(topic, { qos: 1 }, function(err) {
                        if (err) {
                            node.error(`MQTT subscription error: ${err}`);
                            return;
                        }
                        node.log(`Subscribed to ${topic}`);
                        
                        // Initial status publication
                        publishFullStatus();
                        
                        // Start event generators if enabled
                        startEventGenerators();
                        node.log(`Event generators enabled: ${node.generateRandomEvents}`);
                        node.log(`RFID auto-generate: ${node.components.rfid.autoGenerate}`);
                        node.log(`Input auto-change: ${node.components.inputs.autoChange}`);
                    });
                }
            };
            
            // Register for status updates from the broker
            if (node.mqttBroker.connected) {
                node.log("MQTT broker already connected on startup, initializing directly");
                handleBrokerStatus('connected');
            } else {
                node.log("MQTT broker not connected on startup, waiting for connection event");
            }
            node.brokerStatusListener = (status) => handleBrokerStatus(status);
            node.mqttBroker.on('connectionStatus', node.brokerStatusListener);
            
            // Add message handler
            node.mqttMessageHandler = function(topic, payload, packet) {
                handleMqttMessage(topic, payload, packet);
            };
            node.mqttBroker.on('messageReceived', node.mqttMessageHandler);
            
            // Fallback: Start event generators after a short delay to ensure initialization
            setTimeout(() => {
                if (!node.components.rfid.timer && node.generateRandomEvents) {
                    node.log("Using fallback mechanism to start event generators");
                    startEventGenerators();
                }
            }, 2000);
        }
        
        // Input handler - used to generate events on demand from flow
        node.on('input', function(msg) {
            // Handle commands/events from Node-RED flow
            if (msg.topic === 'rfid/generate') {
                generateRfidEvent();
            } else if (msg.topic === 'input/generate') {
                generateInputEvent();
            } else if (msg.topic === 'start_auto_generation') {
                // Direct command to start auto-generation
                node.log("Manual start of event generators requested");
                if (node.components.rfid.timer) {
                    node.log("Stopping existing timers first");
                    stopEventGenerators();
                }
                startEventGenerators();
            } else if (msg.topic === 'relay/set' && typeof msg.payload === 'object') {
                processCommand('relay/set', msg.payload);
            } else if (msg.topic === 'status/get') {
                publishFullStatus();
            } else if (msg.topic === 'mqtt/publish' && msg.payload && msg.payload.topic && msg.payload.message) {
                // Allow direct MQTT publishing
                publishMqttMessage(msg.payload.topic, msg.payload.message, msg.payload.options || {});
            }
        });
        
        // Cleanup on node close
        node.on('close', function(done) {
            // Stop all timers
            stopEventGenerators();
            
            // Unsubscribe from MQTT
            if (node.mqttBroker) {
                if (node.mqttBroker.connected) {
                    node.mqttBroker.client.unsubscribe(`${node.mqttTopics.command}/#`);
                }
                
                if (node.brokerStatusListener) {
                    node.mqttBroker.removeListener('connectionStatus', node.brokerStatusListener);
                }
                
                if (node.mqttMessageHandler) {
                    node.mqttBroker.removeListener('messageReceived', node.mqttMessageHandler);
                }
                
                node.mqttBroker.deregister(node);
            }
            
            done();
        });
        
        // Set initial node status
        updateStatus();
    }
    
    RED.nodes.registerType("esp32-simulator", ESP32SimulatorNode);
}; 