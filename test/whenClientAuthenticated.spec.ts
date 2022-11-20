
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';
import { RedisOptions, RedisService } from '../src/service/redisService';
import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { ConfigService } from '../src/service/configService';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('WhenClientAuthenticated', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('task will start after 5 seconds because no config file exits', async () => {

        class Mock extends WhenClientAuthenticated {
            /**
             *
             */
            constructor(redis: RedisOptions, config: ConfigService) {
                super(redis, config);

            }
            counter = 0;
            override async start(): Promise<void> {
                this.counter++;
                await super.start();
            }
        }
        const configService = new ConfigService();
        const task = new Mock({ host: 'localhost:6380' }, configService);
        await task.start();
        await Util.sleep(6000);//wait for 5 seconds
        expect(task.counter).to.equal(2);


    }).timeout(10000)

    it('task will start after 5 seconds because no redis exits', async () => {

        class Mock extends WhenClientAuthenticated {
            constructor(redis: RedisOptions, config: ConfigService) {
                super(redis, config);

            }
            counter = 0;
            host = '';
            override async start(): Promise<void> {
                this.counter++;

                await super.start();

            }
            override  async readGatewayId() {
                await super.readGatewayId();
                this.host = this.gatewayId;
            }
        }


        const configService = new ConfigService();
        await configService.setGatewayId('1234');
        const task = new Mock({ host: 'localhost:6380' }, configService);
        await task.start();
        await Util.sleep(6000);//wait for 5 seconds
        expect(task.counter).to.equal(2);
        expect(task.host).to.equal('1234');


    }).timeout(100000)


    it('onMessageExecuted', async () => {

        class Mock extends WhenClientAuthenticated {

            constructor(redis: RedisOptions, config: ConfigService) {
                super(redis, config);

            }
            isCalled = false;

            override async onMessage(channel: string, message: string): Promise<void> {
                this.isCalled = true;
                await super.onMessage(channel, message);
            }
        }


        const configService = new ConfigService();
        await configService.setGatewayId('1234');
        const task = new Mock({ host: 'localhost:6379' }, configService);
        await task.start();
        const redis = new RedisService('localhost:6379');
        await redis.publish(`/tunnel/configure/1234`, 'something');
        await Util.sleep(3000);
        expect(task.isCalled).to.be.true;


    }).timeout(100000)


})