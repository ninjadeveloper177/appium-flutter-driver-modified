"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObservatoryWsUri = exports.startIOSSession = void 0;
// @ts-ignore
const appium_ios_device_1 = require("appium-ios-device");
const appium_support_1 = require("appium-support");
const appium_xcuitest_driver_1 = __importDefault(require("appium-xcuitest-driver"));
const asyncbox_1 = require("asyncbox");
const bluebird_1 = __importDefault(require("bluebird"));
const net_1 = __importDefault(require("net"));
const portscanner_1 = require("portscanner");
const logger_1 = require("../logger");
const observatory_1 = require("./observatory");
const LOCALHOST = `127.0.0.1`;
const PORT_CLOSE_TIMEOUT = 15 * 1000; // 15 seconds
const setupNewIOSDriver = async (caps) => {
    const iosArgs = {
        javascriptEnabled: true,
    };
    const iosdriver = new appium_xcuitest_driver_1.default(iosArgs);
    const capsCopy = Object.assign({}, caps, { newCommandTimeout: 0 });
    await iosdriver.createSession(capsCopy);
    return iosdriver;
};
exports.startIOSSession = async (caps) => {
    logger_1.log.info(`Starting an IOS proxy session`);
    const iosdriver = await setupNewIOSDriver(caps);
    const observatoryWsUri = await exports.getObservatoryWsUri(iosdriver);
    return Promise.all([
        iosdriver,
        observatory_1.connectSocket(observatoryWsUri, caps.retryBackoffTime, caps.maxRetryCount),
    ]);
};
const waitForPortIsAvailable = async (port) => {
    let isPortBusy = (await portscanner_1.checkPortStatus(port, LOCALHOST)) === `open`;
    if (isPortBusy) {
        logger_1.log.warn(`Port #${port} is busy. Did you quit the previous driver session(s) properly?`);
        const timer = new appium_support_1.timing.Timer().start();
        try {
            await asyncbox_1.waitForCondition(async () => {
                try {
                    if ((await portscanner_1.checkPortStatus(port, LOCALHOST)) !== `open`) {
                        logger_1.log.info(`Port #${port} has been successfully released after ` +
                            `${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
                        isPortBusy = false;
                        return true;
                    }
                }
                catch (ign) {
                    logger_1.log.error(ign);
                }
                return false;
            }, {
                intervalMs: 300,
                waitMs: PORT_CLOSE_TIMEOUT,
            });
        }
        catch (ign) {
            logger_1.log.warn(`Did not know how to release port #${port} in ` +
                `${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
        }
    }
    if (isPortBusy) {
        throw new Error(`The port :${port} is occupied by an other process. ` +
            `You can either quit that process or select another free port.`);
    }
};
exports.getObservatoryWsUri = async (proxydriver) => {
    const urlObject = observatory_1.processLogToGetobservatory(proxydriver.logs.syslog.logs);
    const { udid } = proxydriver.opts;
    if (!proxydriver.isRealDevice()) {
        logger_1.log.info(`Running on iOS simulator`);
        return urlObject.toJSON();
    }
    logger_1.log.info(`Running on iOS real device`);
    await waitForPortIsAvailable(urlObject.port);
    const localServer = net_1.default.createServer(async (localSocket) => {
        let remoteSocket;
        try {
            remoteSocket = await appium_ios_device_1.utilities.connectPort(udid, urlObject.port);
        }
        catch (e) {
            localSocket.destroy();
            return;
        }
        const destroyCommChannel = () => {
            remoteSocket.unpipe(localSocket);
            localSocket.unpipe(remoteSocket);
        };
        remoteSocket.once(`close`, () => {
            destroyCommChannel();
            localSocket.destroy();
        });
        localSocket.once(`end`, destroyCommChannel);
        localSocket.once(`close`, () => {
            destroyCommChannel();
            remoteSocket.destroy();
        });
        localSocket.pipe(remoteSocket);
        remoteSocket.pipe(localSocket);
    });
    const listeningPromise = new bluebird_1.default((resolve, reject) => {
        localServer.once(`listening`, resolve);
        localServer.once(`error`, reject);
    });
    localServer.listen(urlObject.port);
    try {
        await listeningPromise;
    }
    catch (e) {
        logger_1.log.errorAndThrow(`Failed to listen the port ${urlObject.port}: ${e}`);
    }
    logger_1.log.info(`Port forwarding to: ${urlObject.port}`);
    process.on(`beforeExit`, () => {
        localServer.close();
    });
    return urlObject.toJSON();
};
//# sourceMappingURL=ios.js.map