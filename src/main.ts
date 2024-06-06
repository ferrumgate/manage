import log4js from 'log4js';
import http from 'http';
import httpProxy from 'http-proxy';


log4js.configure({
    appenders: { out: { type: 'stdout', layout: { type: 'pattern', pattern: '[%d] [%p] %c - %m' } } },
    categories: { default: { appenders: ['out'], level: process.env.LOG_LEVEL?.toString() || 'info' } }
});

/**
 * @description log4js instance for logging
 * @example logger.error() logger.info() logger.warn() logger.fatal()
 */
const logger = log4js.getLogger();

async function main() {
    const esHost = process.env.ES_HOST || 'localhost:9200';
    const esPort = Number(esHost.split(':')[1]) || 9200;
    const esUser = process.env.ES_USER || '';
    const esPass = process.env.ES_PASS || '';
    const ferrumCloudId = process.env.FERRUM_CLOUD_ID || '';
    const ferrumEsHost = process.env.ES_MULTI_HOST || 'http://1.2.3.4:9200';
    const ferrumEsUser = process.env.ES_MULTI_USER || '';
    const ferrumEsPass = process.env.ES_MULTI_PASS || '';

    if (!ferrumCloudId) {
        logger.warn('FERRUM_CLOUD_ID is not set. exiting');
        return;
    }
    //create proxy
    logger.info(`Proxying ${esHost} to ${ferrumEsHost}`);
    var proxy = httpProxy.createServer({
        target: `${ferrumEsHost}`,
        secure: false,
    });

    proxy.on('error', function (err, req: any, res: any) {
        logger.error(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end('Something went wrong. And we are reporting a custom error message.');
    });

    //create server
    const checkAuthorizationHeader = (req: any) => {
        if (req.headers['authorization'] && req.headers['authorization'].startsWith('Basic ')) {
            const auth = req.headers['authorization'].split(' ')[1];
            const [user, pass] = Buffer.from(auth, 'base64').toString().split(':');
            if (user === esUser && pass === esPass) {
                delete req.headers.authorization;
                if (ferrumEsUser && ferrumEsPass)
                    req.headers['authorization'] = `Basic ${Buffer.from(`${ferrumEsUser}:${ferrumEsPass}`).toString('base64')}`;
                return true;
            }
        }
        return false;
    }
    const writeUnauthorized = (res: any) => {
        res.writeHead(401, {
            'Content-Type': 'text/plain'
        });
        res.end('Unauthorized access');
    }
    //simple rate limit for scroll
    let lastScrollRequestTime = 0;
    let scrollRequestCount = 0;

    const checkRequest = (req: any) => {
        //we are allowing only few requests
        /*  if (req.url.startsWith(`/_search/scroll`)) {
             scrollRequestCount++;
             const now = new Date().getMinutes();
             if (now !== lastScrollRequestTime) {
                 lastScrollRequestTime = now;
                 scrollRequestCount = 0;
             }
             if (scrollRequestCount > 30) {
                 logger.error(`Rate limit exceeded for scroll request`);
                 return false;
             }
             logger.info(`founded Index :${`/_search/scroll`}`);
             return true;
         } */
        if (req.url.startsWith(`/_cat/indices/${ferrumCloudId}-*`)) {
            return true;
        }
        let indexes = decodeURIComponent(req.url).split('/')[1].split(',');
        let allIndexes = true;
        indexes.forEach((index: string) => {
            logger.info(`founded Index :${index}`);
            if (!index.startsWith(`${ferrumCloudId}-`)) {
                allIndexes = false;
            }
        });
        if (allIndexes) {
            return true;
        }

        logger.error(`Invalid request ${req.url}`);
        return false;
    }
    const printRequest = (req: any) => {
        logger.info(`Method :${req.method}`);
        logger.info(`Url :${req.url}`);
        logger.info(`Body :${req.body ? JSON.stringify(req.body) : ''}`);
        logger.info(`Headers :${req.headers ? JSON.stringify(req.headers) : ''}`);
        logger.info(`********************************************`);
    }

    var server = http.createServer((req: any, res: any) => {
        logger.info(`url :${req.url}`)
        if (!checkAuthorizationHeader(req)) {
            writeUnauthorized(res);
            printRequest(req)
            return;
        }
        if (!checkRequest(req)) {
            writeUnauthorized(res);
            printRequest(req);
            return;
        }

        proxy.web(req, res);
    }).listen(esPort);
    logger.info(`proxy server running at port ${esPort}`);
    //handle signals
    process.on('SIGINT', async () => {
        logger.warn("sigint catched");
        server.close();
        process.exit(0);

    });
    process.on('SIGTERM', async () => {
        logger.warn("sigterm catched");
        server.close();
        process.exit(0);

    });
}

main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })