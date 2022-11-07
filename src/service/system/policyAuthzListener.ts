import NodeCache from "node-cache";
import { Tunnel } from "../../model/tunnel";
import { logger } from "../../common";
import { ConfigService } from "../configService";
import { RedisPipelineService, RedisService } from "../redisService";
import { TunnelService } from "../tunnelService";
import { SystemWatcherService } from "./systemWatcherService";
import { PolicyAuthzResult, PolicyService } from "../policyService";
import { rootCertificates } from "tls";
import { channel } from "diagnostics_channel";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');



//below are how commands work

// commandId/reset  
// commandId/update/clientId/isDrop/policyNumber/why/policyId
// commandId/delete/clientId
interface PolicyRoomCommand {
    isOK?: boolean;
    isReset?: boolean;
    isDelete?: boolean;
    trackId?: number;
    policyResult?: PolicyAuthzResult;
}

export class PolicyRoomService {
    serviceId: string = '';
    hostId: string = '';
    instanceId: string = '';
    private interval: any;


    redisStreamKey: string;
    private commandId: number = 0;
    private redisLocal: RedisService;
    //pipeline

    private waitList: PolicyRoomCommand[] = [];
    private waitListInterval: any;
    public lastProcessSuccessfull: number = new Date().getTime();;
    constructor(_hostId: string, _serviceId: string, _instanceId: string) {
        this.hostId = _hostId;
        this.serviceId = _serviceId;
        this.instanceId = _instanceId;

        this.redisLocal = new RedisService(process.env.REDIS_LOCAL_HOST || "localhost:6379", process.env.REDIS_LOCAL_PASS);
        this.redisStreamKey = `/policy/service/${this.hostId}/${this.serviceId}/${this.instanceId}`;

    }
    private xaddId(commandId: number) {
        return `${new Date().getTime()}-${commandId}`;
    }

    get commandList() {
        return this.waitList;
    }

    async start() {
        this.interval = setIntervalAsync(async () => {
            await this.pushOk();
        }, 5000);
        this.waitListInterval = setIntervalAsync(async () => {
            await this.processWaitList();
        }, 1000);
    }
    async stop() {
        this.waitList.splice(0);
        await clearIntervalAsync(this.interval);
        await clearIntervalAsync(this.waitListInterval);
    }
    async pushOk() {
        this.waitList.push({ isOK: true })
    }
    async pushReset() {
        this.waitList.splice(0);
        this.waitList.push({ isReset: true })
    }
    async pushDelete(trackId: number) {
        this.waitList.push({ trackId: trackId, isDelete: true });
    }
    async push(trackId: number, result: PolicyAuthzResult) {
        this.waitList.push({ trackId: trackId, policyResult: result });
    }
    private async processWaitList() {
        let tmp = this.commandId;//store it
        try {
            let page = 0;
            while (this.waitList.length) {
                logger.info(`executing wait list service on /${this.hostId}/${this.serviceId}/${this.instanceId} page:${page}`)
                let snapshot = this.waitList.slice(0, 10000);
                let pipeline = await this.redisLocal.multi();
                for (const cmd of snapshot) {
                    if (cmd.isReset) {
                        await pipeline.delete(this.redisStreamKey);
                        this.commandId = 0;
                        this.commandId++;
                        await pipeline.xadd(this.redisStreamKey, { cmd: `${this.commandId}/reset` }, this.xaddId(this.commandId));

                    } else
                        if (cmd.isOK) {
                            this.commandId++;
                            await pipeline.xadd(this.redisStreamKey, { cmd: `${this.commandId}/ok` }, this.xaddId(this.commandId));
                        }
                        else if (cmd.isDelete && cmd.trackId) {
                            this.commandId++;
                            await pipeline.xadd(this.redisStreamKey, { cmd: `${this.commandId}/delete/${cmd.trackId}` }, this.xaddId(this.commandId));
                        }
                        else if (cmd.trackId && cmd.policyResult) {
                            this.commandId++;
                            let isDrop = cmd.policyResult.error ? 1 : 0;
                            await pipeline.xadd(this.redisStreamKey, { cmd: `${this.commandId}/update/${cmd.trackId}/${isDrop}/${cmd.policyResult.index || 0}/${cmd.policyResult.error + 10000}/${cmd.policyResult.rule?.id || ''}` }, this.xaddId(this.commandId));
                        }
                }
                await pipeline.exec();
                this.waitList.splice(0, 10000);
            }
            this.lastProcessSuccessfull = new Date().getTime();
        } catch (err) {
            logger.error(err);
            this.commandId = tmp;
        }
    }

}

export class PolicyAuthzListener {

    private redisLocalServiceListener: RedisService;
    private redisGlobal: RedisService;
    private cache: NodeCache;
    private waitList: { tunnel?: Tunnel, action: string }[] = [];
    private waitListTimer: any | null = null;

    private roomList = new Map<string, PolicyRoomService>();
    private hostId = '';
    private isStarted = false;
    constructor(private policyService: PolicyService,
        private systemWatcher: SystemWatcherService) {
        this.hostId = process.env.HOST_ID || '';
        this.cache = new NodeCache({ checkperiod: 60, deleteOnExpire: true, useClones: false, stdTTL: 60 });
        this.redisGlobal = new RedisService(process.env.REDIS_HOST || "localhost:6379", process.env.REDIS_PASS);
        this.redisLocalServiceListener = new RedisService(process.env.REDIS_LOCAL_HOST || "localhost:6379", process.env.REDIS_LOCAL_PASS);

        this.cache.on("expired", async (key, value: PolicyRoomService) => {
            await value.stop();
            this.roomList.delete(key);
        });


    }
    async setHostId(hostId: string) {
        this.hostId = hostId;
    }
    async stop() {
        await this.redisLocalServiceListener.disconnect();
        clearIntervalAsync(this.waitListTimer);
    }
    async start() {
        this.systemWatcher.on('tunnel', async (arg: { tunnel?: Tunnel, action: string }) => {
            this.waitList.push(arg);
        })

        if (this.waitListTimer)
            clearIntervalAsync(this.waitListTimer);
        this.waitListTimer = setIntervalAsync(async () => {
            await this.startListening();
            await this.processWaitList();
        }, 1000);
    }
    async policyCalculate(item: { tunnel?: Tunnel, action: string }) {
        if (item.action == 'reset') {
            for (const room of this.roomList.values()) {
                await room.pushReset();
            }
        }
        else {
            const hostId = item.tunnel?.hostId;
            if (!hostId || this.hostId != hostId)//check if this tunnel belongs to this tunnel
                return;
            if (!item.tunnel?.trackId)
                return;

            for (const room of this.roomList.values()) {
                if (room.hostId != this.hostId)//check if any problem
                    continue;
                if (item.action == 'delete')
                    await room.pushDelete(item.tunnel.trackId);
                else {
                    const presult = await this.policyService.authorize(item.tunnel.trackId, room.serviceId, false, item.tunnel);
                    await room.push(item.tunnel.trackId, presult);
                }
            }

        }

    }

    async processWaitList() {

        try {
            if (this.waitList.length) {
                logger.info(`process waiting list count ${this.processWaitList.length}`);
            }

            while (this.waitList.length) {
                const items = this.waitList.slice(0, 10000);
                //process
                for (const item of items) {
                    await this.policyCalculate(item);
                }

                this.waitList.splice(0, 10000);
            }

        } catch (err) {//we are not waiting an error here, so important otherwise memory problem occurs
            logger.fatal(err);//
        }

    }

    async replicate(hostId?: string, serviceId?: string, instanceId?: string) {
        try {
            if (!hostId || !serviceId || !instanceId) return;
            let key = `/${hostId}/${serviceId}/${instanceId}`;
            logger.info(`replicate to me ${key}`);

            let item = this.cache.get(key) as PolicyRoomService;
            if (item) {
                await item.pushReset();

            } else {
                const room = new PolicyRoomService(hostId, serviceId, instanceId);
                this.cache.set(key, room);
                this.roomList.set(key, room);
                await room.pushReset();
                item = room;
            }
            await this.fillRoomService(item);
        } catch (err) {
            logger.error(err);
        }
    }
    async getRoom(hostId: string, serviceId: string, instanceId: string) {

        return await this.roomList.get(`/${hostId}/${serviceId}/${instanceId}`);
    }
    async addRoom(room: PolicyRoomService) {
        let key = `/${room.hostId}/${room.serviceId}/${room.instanceId}`;
        this.cache.set(key, room)
        await this.roomList.set(key, room);
    }
    async fillRoomService(room: PolicyRoomService) {
        //snapshot of tunnels
        logger.info(`filling service /${room.hostId}/${room.serviceId}/${room.instanceId}`)
        let allTunnels = [...this.systemWatcher.tunnels.values()];
        let filteredTunnels = allTunnels.filter(x => x.hostId == room.hostId);//only this service
        for (const tunnel of filteredTunnels) {
            if (!tunnel.trackId)
                continue;
            const pResult = await this.policyService.authorize(tunnel.trackId, room.serviceId, false, tunnel);
            await room.push(tunnel.trackId, pResult);
        }
    }

    async iAmAliveMessage(hostId?: string, serviceId?: string, instanceId?: string) {
        if (!hostId || !serviceId || !instanceId) return;
        let key = `/${hostId}/${serviceId}/${instanceId}`;
        logger.info(`i am alive message from ${key}`);
        const item = this.cache.get(key) as PolicyRoomService;
        if (item) {//cache has this item, then set ttl again
            this.cache.ttl(key, 60);
        }
        //set to the global
        let serviceKey = `/service/${hostId}/${serviceId}/${instanceId}`;
        await this.redisGlobal.hset(serviceKey, {
            hostId: hostId, serviceId: serviceId, instanceId: instanceId, lastSeen: new Date().getTime()
        })
        await this.redisGlobal.expire(serviceKey, 5 * 60 * 1000);

    }
    async onServiceMessage(channel: string, message: string) {
        try {
            const parts = message.split('/');
            if (!parts.length)
                return;
            if (parts[0] == 'alive') {//client sended alive
                await this.iAmAliveMessage(...parts.slice(1))
            }


            if (parts[0] == 'replicate') {
                await this.replicate(...parts.slice(1));
            }
        } catch (err) {
            logger.error(err);
        }
    }
    private onMessage = async (channel: string, message: string) => {
        await this.onServiceMessage(channel, message);
    }

    async startListening() {
        try {
            if (this.isStarted) return;
            await this.redisLocalServiceListener.onMessage(this.onMessage);
            await this.redisLocalServiceListener.subscribe(`/policy/service`);
            this.isStarted = true;
        } catch (err) {
            logger.error(err);
        }
    }


}