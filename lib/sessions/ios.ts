// @ts-ignore
import { utilities } from 'appium-ios-device';
import { timing } from 'appium-support';
import XCUITestDriver from 'appium-xcuitest-driver';
import { waitForCondition } from 'asyncbox';
import B from 'bluebird';
import net from 'net';
import { checkPortStatus } from 'portscanner';
import { log } from '../logger';
import { connectSocket, processLogToGetobservatory } from './observatory';

const LOCALHOST = `127.0.0.1`;
const PORT_CLOSE_TIMEOUT = 15 * 1000; // 15 seconds

const setupNewIOSDriver = async (caps) => {
  const iosArgs = {
    javascriptEnabled: true,
  };

  const iosdriver = new XCUITestDriver(iosArgs);
  const capsCopy = Object.assign({}, caps, { newCommandTimeout: 0 });
  await iosdriver.createSession(capsCopy);

  return iosdriver;
};

export const startIOSSession = async (caps) => {
  log.info(`Starting an IOS proxy session`);
  const iosdriver = await setupNewIOSDriver(caps);
  const observatoryWsUri = await getObservatoryWsUri(iosdriver);
  return Promise.all([
    iosdriver,
    connectSocket(observatoryWsUri, caps.retryBackoffTime, caps.maxRetryCount),
  ]);
};

const waitForPortIsAvailable = async (port) => {
  let isPortBusy = (await checkPortStatus(port, LOCALHOST)) === `open`;
  if (isPortBusy) {
    log.warn(`Port #${port} is busy. Did you quit the previous driver session(s) properly?`);
    const timer = new timing.Timer().start();
    try {
      await waitForCondition(async () => {
        try {
          if ((await checkPortStatus(port, LOCALHOST)) !== `open`) {
            log.info(`Port #${port} has been successfully released after ` +
              `${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
            isPortBusy = false;
            return true;
          }
        } catch (ign) {
          log.error(ign);
        }
        return false;
      }, {
        intervalMs: 300,
        waitMs: PORT_CLOSE_TIMEOUT,
      });
    } catch (ign) {
      log.warn(`Did not know how to release port #${port} in ` +
        `${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
    }
  }

  if (isPortBusy) {
    throw new Error(`The port :${port} is occupied by an other process. ` +
      `You can either quit that process or select another free port.`);
  }
};

export const getObservatoryWsUri = async (proxydriver) => {
  const urlObject = processLogToGetobservatory(proxydriver.logs.syslog.logs);
  const { udid } = proxydriver.opts;

  if (!proxydriver.isRealDevice()) {
    log.info(`Running on iOS simulator`);
    return urlObject.toJSON();
  }

  log.info(`Running on iOS real device`);
  await waitForPortIsAvailable(urlObject.port);
  const localServer = net.createServer(async (localSocket) => {
    let remoteSocket;
    try {
      remoteSocket = await utilities.connectPort(udid, urlObject.port);
    } catch (e) {
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
  const listeningPromise = new B((resolve, reject) => {
    localServer.once(`listening`, resolve);
    localServer.once(`error`, reject);
  });
  localServer.listen(urlObject.port);
  try {
    await listeningPromise;
  } catch (e) {
    log.errorAndThrow(`Failed to listen the port ${urlObject.port}: ${e}`);
  }

  log.info(`Port forwarding to: ${urlObject.port}`);

  process.on(`beforeExit`, () => {
    localServer.close();
  });
  return urlObject.toJSON();
};
