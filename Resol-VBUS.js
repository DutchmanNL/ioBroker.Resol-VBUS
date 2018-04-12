/*! ############################################################################################################# */
/*! ### ioBroker Script zum auslesen und konfigurieren von Resol und anderen auf VBus basierenden Steuerungen ### */
/*! ####### Das Script basiert auf auf dem Node JS Modul "resol-vbus" von Daniel Wippermann und wurde von ####### */
/*! ################### Dutchman, meifi2017 & AlexW für die Verwendung in ioBroker angepasst! ################### */
/*! ############################################################################################################# */
/*! ############################################ V 1.3 ########################################################## */

var fs = require('fs');
var express = require('express');
var kue = require('kue');
var _ = require('lodash');
var optimist = require('optimist');
var Q = require('q');
var vbus = require('resol-vbus/src/index');
var action = {
    "loadAll": true, // Bedeutet das beim Start des Scripts der Controller ausgelesen werden soll!
    "out": "/opt/iobroker/ResolVBusConfigTest.json" // Pfad wo die gesamten Konfigurationswerte des Controllers beim Start des Scripts gespeichert werden sollen 
};

/*! Hier bitte die spezifischen Verbindungsdaten eintragen! */

var config = {
    "connection": {
        "class": "TcpConnection",
        "options": {
            "host": "192.168.178.100", // IP-Adresse oder VBus.net Adresse hier eintragen
            "viaTag": "", // Bei Verbindung über VBus.net ist hier das viaTag einzutragen
            "password": "vbus", // Passwort, Standard ist: vbus
            // "channel" : "1" 		// Channel, wird nur für die Verbindung über einen DL3 benötigt und ist standardmäßig auskommentiert!
        }
    }
};

/*! Ab hier reiner Code */

var timestamp;

var Live = function() {

    var vbuslive = require('resol-vbus');
    var headerSetlive = new vbuslive.HeaderSet();
    var connlive;

    // Schedule every 30 seconds
    schedule("*/30 * * * * *", function() {

        // Define connection values
        var connectionConfigLive = config.connection;
        var ConnectionLive = vbuslive[connectionConfigLive.class];
        connlive = new ConnectionLive(connectionConfigLive.options);

        // Log connection status
        var onConnectionStateChange = function(state) {
            console.debug(state);
        };

        var onPacket = function(packet) {
            headerSetlive.addHeader(packet);
        };

        connlive.on('connectionState', onConnectionStateChange);
        connlive.on('packet', onPacket);

        connlive.connect().done(function() {

            setTimeout(function() {
                connlive.disconnect();

                //create header packages
                var packets = headerSetlive.getSortedHeaders();
                var spec = vbuslive.Specification.getDefaultSpecification();
                var packetFields = spec.getPacketFieldsForHeaders(packets);

                var packet = null;
                var counter = 0;

                packetFields.forEach(function(packetField) {
                    counter = counter + 1;
                    if (packet !== packetField.packet) {
                        packet = packetField.packet;
                        console.debug(packetField.packetSpec.fullName);

                    }
                    // write values in memory
                    packetField.name = packetField.name.replace(/ /g, "");

                    console.debug("Value received : " + packetField.name + " = " + packetField.formatTextValue());

                    try {
                        if (getIdByName(packetField.name) != null) {
                            setState("vbus.values." + packetField.name, packetField.formatTextValue(), true);
                        } else {
                            createState("vbus.values." + packetField.name, {
                                name: packetField.name,
                                type: 'string',
                                role: 'value',
                                def: packetField.formatTextValue(),
                            });
                        }
                    } catch (e) {}
                });
                // 10 second timer, collection all information takes some seconds Bild
            }, 10000);
        });
    });
};

var createStates = function() {

    var file = action.out;

    fs.readFile(file, 'utf8', function(err, body) {
        if (err) {}

        JSON.parse(body, (key, value) => {
            var jsonkey = key;
            var jsonvalue = value;
            try {
                if (jsonkey !== "" && getIdByName(jsonkey) != null)
                    setState("vbus.config." + jsonkey, parseFloat(jsonvalue), true);
            } catch (e) {}
            try {
                if (jsonkey !== "")
                    createState("vbus.config." + jsonkey, {
                        name: jsonkey,
                        type: 'number',
                        role: 'value',
                        def: parseFloat(jsonvalue),
                    });
            } catch (e) {}
        });
    });
    action.loadAll = false;
    timestamp = Date.now();
    var ready = "Ready for processing...";
    setTimeout(console.log, 10000, ready);
    return;
};

var writeStates = function() {
    on({
        id: /^javascript\.\d\.vbus.config./,
        change: "ne"
    }, function(obj) {
        var statename = obj.name;
        var value = obj.state.val;
        var oldValue = obj.oldState.val;
        var lastChanged = getState(obj.id).lc;
        if (typeof oldValue !== "undefined" && lastChanged > (timestamp + 10000)) {
            console.log(statename + " hat sich von " + oldValue + " auf " + value + " geändert!");
            jsonWrite = JSON.stringify({
                [statename]: value
            });
            action.save = true;
            action.data = jsonWrite;
            setState("vbus.config." + statename, parseFloat(value), true);
            return runSingleShot(action);
        }
    });
};

var promise = vbus.utils.promise;

var i18n = new vbus.I18N('en');

var reportProgress = function(message) {
    var line;
    if (_.isString(message)) {
        line = message;
    } else if (message.message === 'OPTIMIZING_VALUES') {
        line = i18n.sprintf('Optimizing set of values for round %d', message.round);
    } else if (message.message === 'GETTING_VALUE') {
        line = i18n.sprintf('Getting value %d/%d, try %d: %s', message.valueNr, message.valueCount, message.tries, message.valueId);
    } else if (message.message === 'SETTING_VALUE') {
        line = i18n.sprintf('Setting value %d/%d, try %d: %s', message.valueNr, message.valueCount, message.tries, message.valueId);
    } else if (message.message === 'CONNECTION_STATE') {
        line = i18n.sprintf('Connection state changed to %s', message.connectionState);
    } else if (message.message === 'WAITING_FOR_FREE_BUS') {
        line = i18n.sprintf('Waiting for free bus');
    } else if (message.message === 'RELEASING_BUS') {
        line = i18n.sprintf('Releasing bus');
    } else {
        line = i18n.sprintf('%s: %s', message.message, JSON.stringify(message));
    }

    if (_.isNumber(message.round)) {
        line = i18n.sprintf('[%d] %s', message.round, line);
    }

    console.log(line);
};

var loadJsonFile = function(filename) {
    return promise(function(resolve, reject) {
        fs.readFile(filename, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    }).then(function(data) {
        return JSON.parse(data);
    });
};

var createConnection = function() {
    var connectionConfig = config.connection;

    var Connection = vbus[connectionConfig.class];

    var conn = new Connection(connectionConfig.options);

    conn.on('connectionState', function(state) {
        reportProgress({
            message: 'CONNECTION_STATE',
            connectionState: state,
        });
    });

    return conn;
};

var processCustomizationJob = function(context, job) {
    'use strict';
    return Q.fcall(function() {
        reportProgress('Waiting for free bus...');

        return context.connection.waitForFreeBus();
    }).then(function(datagram) {
        context.masterAddress = datagram.sourceAddress;

        reportProgress('Found master with address 0x' + context.masterAddress.toString(16));

        context.deviceAddress = context.masterAddress;

        return vbus.ConfigurationOptimizerFactory.createOptimizerByDeviceAddress(context.deviceAddress);
    }).then(function(optimizer) {
        context.optimizer = optimizer;

        context.customizer = new vbus.ConnectionCustomizer({
            deviceAddress: context.deviceAddress,
            connection: context.connection,
            optimizer: context.optimizer,
        });
    }).then(function() {
        var onProgress = function(progress) {
            reportProgress(progress);
        };

        var command = job.data.command;

        var config = job.data.config;
        var currentConfig = context.currentConfig;

        var options = {
            optimize: false,
        };

        if (command === 'load') {
            options.optimize = !config;

            return Q.fcall(function() {
                return context.customizer.loadConfiguration(config, options).progress(onProgress);
            }).then(function(config) {
                return context.optimizer.completeConfiguration(config, currentConfig);
            }).then(function(config) {
                context.currentConfig = config;
            });
        } else if (command === 'save') {
            return Q.fcall(function() {
                return context.customizer.saveConfiguration(config, currentConfig, options).progress(onProgress);
            }).then(function(config) {
                return context.optimizer.completeConfiguration(config, currentConfig);
            }).then(function(config) {
                context.currentConfig = config;
            });
        } else {
            throw new Error('Unknown command ' + JSON.stringify(command));
        }
    });
};

var serve = function() {
    'use strict';
    var context = {};

    return Q.fcall(function() {
        return createConnection();
    }).then(function(conn) {
        context.connection = conn;

        reportProgress('Connecting...');

        return context.connection.connect();
    }).then(function() {
        var jobs = kue.createQueue();
        jobs.process('customization', function(job, done) {
            Q.fcall(function() {
                return processCustomizationJob(context, job);
            }).done(function() {
                console.log('Job done!');

                done();
            }, function(err) {
                console.log('Job failed!');

                done(err);
            });
        });
    }).then(function() {
        var app = express();
        app.get('/config', function(req, res) {
            var jsonConfig = _.reduce(context.currentConfig, function(memo, value) {
                if (!value.ignored) {
                    memo[value.valueId] = value.value;
                }
                return memo;
            }, {});

            res.json(jsonConfig);
        });
        app.use(kue.app);
        app.listen(3000);
    });
};

var runSingleShot = function(action) {
    var context = {};

    if (action.q) {
        reportProgress = function() {};
    }

    return Q.fcall(function() {
        return createConnection();
    }).then(function(conn) {
        context.connection = conn;

    }).then(function(oldConfig) {
        context.oldConfig = oldConfig;

        if (action.loadAll) {
            return null;
        } else if (action.load) {
            return loadJsonFile(action.load);
        }
    }).then(function(loadConfig) {
        context.loadConfig = loadConfig;

        if (action.save) {
            return JSON.parse(jsonWrite);
        }
    }).then(function(saveConfig) {
        context.saveConfig = saveConfig;

        reportProgress('Connecting...');

        return context.connection.connect();
    }).then(function() {
        reportProgress('Waiting for free bus...');

        return context.connection.waitForFreeBus();
    }).then(function(datagram) {
        context.masterAddress = datagram.sourceAddress;

        reportProgress('Found master with address 0x' + context.masterAddress.toString(16));

        context.deviceAddress = context.masterAddress;

        return vbus.ConfigurationOptimizerFactory.createOptimizerByDeviceAddress(context.deviceAddress);
    }).then(function(optimizer) {
        context.optimizer = optimizer;

        if (!optimizer) {
            reportProgress(i18n.sprintf('WARNING: Unable to create optimizer for master with address 0x%04X', context.masterAddress));
        }

        context.customizer = new vbus.ConnectionCustomizer({
            deviceAddress: context.deviceAddress,
            connection: context.connection,
            optimizer: context.optimizer,
        });
    }).then(function() {
        if (context.loadConfig !== undefined) {
            var onProgress = function(progress) {
                reportProgress(progress);
            };

            var config = context.loadConfig;

            var options = {
                optimize: !config,
            };

            return context.customizer.loadConfiguration(config, options).progress(onProgress);
        }
    }).then(function(config) {
        context.loadedConfig = config;

        if (context.saveConfig !== undefined) {
            var onProgress = function(progress) {
                reportProgress(progress);
            };

            var saveConfig = context.saveConfig;
            var oldConfig = context.oldConfig;

            var options = {
                optimize: false,
            };

            return context.customizer.saveConfiguration(saveConfig, oldConfig, options).progress(onProgress);
        } else {
            return config;
        }
    }).then(function(config) {
        var jsonConfig = _.reduce(config, function(memo, value) {
            if (!value.ignored) {
                memo[value.valueId] = value.value;
            }
            return memo;
        }, {});

        jsonConfig = JSON.stringify(jsonConfig);

        if (action.out) {
            return vbus.utils.promise(function(resolve, reject) {
                fs.writeFile(action.out, jsonConfig, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            console.log(jsonConfig);
        }
    }).finally(function() {
        reportProgress('Disconnecting...');
        action.loadAll = false;

        if (context.connection !== null) {
            context.connection.disconnect();
        }
    });
};

var main = function() {
    var argv = optimist.argv;

    if (argv.serve) {
        return serve();
    } else {
        return runSingleShot(action);
    }
};

Q.fcall(main)
    .then(createStates)
    .then(writeStates)
    .then(Live)
    .done();