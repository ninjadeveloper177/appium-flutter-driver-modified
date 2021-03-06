"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLogToGetobservatory = exports.executeElementCommand = exports.connectSocket = void 0;
const url_1 = require("url");
const deserializer_1 = require("../../../finder/nodejs/lib/deserializer");
const logger_1 = require("../logger");
const isolate_socket_1 = require("./isolate_socket");
// SOCKETS
exports.connectSocket = async (dartObservatoryURL, RETRY_BACKOFF = 300000, MAX_RETRY_COUNT = 10) => {
    let retryCount = 0;
    let connectedSocket = null;
    while (retryCount < MAX_RETRY_COUNT && !connectedSocket) {
        if (retryCount > 0) {
            logger_1.log.info(`Waiting ` + RETRY_BACKOFF / 1000 + ` seconds before trying...`);
            await new Promise((r) => setTimeout(r, RETRY_BACKOFF));
        }
        logger_1.log.info(`Attempt #` + (retryCount + 1));
        const connectedPromise = new Promise((resolve) => {
            logger_1.log.info(`Connecting to Dart Observatory: ${dartObservatoryURL}`);
            const socket = new isolate_socket_1.IsolateSocket(dartObservatoryURL);
            const removeListenerAndResolve = (r) => {
                socket.removeListener(`error`, onErrorListener);
                socket.removeListener(`timeout`, onTimeoutListener);
                socket.removeListener(`open`, onOpenListener);
                resolve(r);
            };
            // Add an 'error' event handler for the client socket
            const onErrorListener = (ex) => {
                logger_1.log.error(ex);
                logger_1.log.error(`Check Dart Observatory URI ${dartObservatoryURL}`);
                removeListenerAndResolve(null);
            };
            socket.on(`error`, onErrorListener);
            // Add a 'close' event handler for the client socket
            socket.on(`close`, () => {
                logger_1.log.info(`Connection to ${dartObservatoryURL} closed`);
                // @todo do we need to set this.socket = null?
            });
            // Add a 'timeout' event handler for the client socket
            const onTimeoutListener = () => {
                logger_1.log.error(`Connection to ${dartObservatoryURL} timed out`);
                removeListenerAndResolve(null);
            };
            socket.on(`timeout`, onTimeoutListener);
            const onOpenListener = async () => {
                // tslint:disable-next-line:ban-types
                const originalSocketCall = socket.call;
                socket.call = async (...args) => {
                    try {
                        // `await` is needed so that rejected promise will be thrown and caught
                        return await originalSocketCall.apply(socket, args);
                    }
                    catch (e) {
                        logger_1.log.errorAndThrow(JSON.stringify(e));
                    }
                };
                logger_1.log.info(`Connected to ${dartObservatoryURL}`);
                const vm = await socket.call(`getVM`);
                logger_1.log.info(`Listing all isolates: ${JSON.stringify(vm.isolates)}`);
                const mainIsolateData = vm.isolates.find((e) => e.name === `main`);
                if (!mainIsolateData) {
                    logger_1.log.error(`Cannot get Dart main isolate info`);
                    removeListenerAndResolve(null);
                    return;
                }
                socket.isolateId = mainIsolateData.id;
                // @todo check extension and do health check
                const isolate = await socket.call(`getIsolate`, {
                    isolateId: `${socket.isolateId}`,
                });
                if (!isolate) {
                    logger_1.log.error(`Cannot get main Dart Isolate`);
                    removeListenerAndResolve(null);
                    return;
                }
                if (!Array.isArray(isolate.extensionRPCs)) {
                    logger_1.log.errorAndThrow(`Cannot get Dart extensionRPCs from isolate ${JSON.stringify(isolate)}`);
                    removeListenerAndResolve(null);
                    return;
                }
                if (isolate.extensionRPCs.indexOf(`ext.flutter.driver`) < 0) {
                    const msg = `"ext.flutter.driver" is not found in "extensionRPCs" ${JSON.stringify(isolate.extensionRPCs)}`;
                    logger_1.log.error(msg);
                    removeListenerAndResolve(null);
                    return;
                }
                removeListenerAndResolve(socket);
            };
            socket.on(`open`, onOpenListener);
        });
        retryCount++;
        connectedSocket = await connectedPromise;
        if (!connectedSocket && retryCount === MAX_RETRY_COUNT - 1) {
            logger_1.log.errorAndThrow(`Failed to connect ` + MAX_RETRY_COUNT + ` times. Aborting.`);
        }
    }
    retryCount = 0;
    return connectedSocket;
};
exports.executeElementCommand = async function (command, elementBase64, extraArgs = {}) {
    const elementObject = elementBase64 ? deserializer_1.deserialize(elementBase64) : {};
    const serializedCommand = { command, ...elementObject, ...extraArgs };
    logger_1.log.debug(`>>> ${JSON.stringify(serializedCommand)}`);
    const data = await this.socket.executeSocketCommand(serializedCommand);
    logger_1.log.debug(`<<< ${JSON.stringify(data)} | previous command ${command}`);
    if (data.isError) {
        throw new Error(`Cannot execute command ${command}, server reponse ${JSON.stringify(data, null, 2)}`);
    }
    return data.response;
};
exports.processLogToGetobservatory = (adbLogs) => {
    const observatoryUriRegEx = new RegExp(`Observatory listening on ((http|\/\/)[a-zA-Z0-9:/=_\\-\.\\[\\]]+)`);
    // @ts-ignore
    const observatoryMatch = adbLogs
        .map((e) => e.message)
        .reverse()
        .find((e) => e.match(observatoryUriRegEx))
        .match(observatoryUriRegEx);
    if (!observatoryMatch) {
        throw new Error(`can't find Observatory`);
    }
    const dartObservatoryURI = observatoryMatch[1];
    const dartObservatoryURL = new url_1.URL(dartObservatoryURI);
    dartObservatoryURL.protocol = `ws`;
    dartObservatoryURL.pathname += `ws`;
    return dartObservatoryURL;
};
//# sourceMappingURL=observatory.js.map