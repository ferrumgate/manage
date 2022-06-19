import { User } from "../model/user";
import { logger } from "../common";
import { ErrorCodes, RestfullException } from "../restfullException";
import { ConfigService } from "./configService";
import { RedisService } from "./redisService";
import { Util } from "../util";
import { Tunnel } from "../model/tunnel";
import { HelperService } from "./helperService";


/**
 * @summary execute tunnel business, create tunnel related objects in redis,
 * find an ip 
 */
export class TunnelService {
    /**
     *
     */
    private _lastUsedIp: bigint = BigInt(0);
    private clientNetworkUsedList = '/clientNetwork/used';
    constructor(private config: ConfigService) {


    }
    get lastUsedIp() {
        return this._lastUsedIp;
    }
    async getEmptyIp(redisService: RedisService) {
        const network = await this.config.getClientNetwork();
        if (!network.includes('/')) {
            logger.error("config client network is not valid");
            throw new RestfullException(500, ErrorCodes.ErrInternalError, "client network is not valid");
        }
        const parts = network.split('/');
        const range = Util.ipCidrToRange(parts[0], Number(parts[1]));
        let start = this.lastUsedIp || Util.ipToBigInteger(range.start) + 1n;//for performance track last used ip
        let end = Util.ipToBigInteger(range.end);
        if (start >= end)// if all pool ips used, then start from beginning for search
            start = Util.ipToBigInteger(range.start);




        for (let s = start; s < end; s++) {
            const ip = Util.bigIntegerToIp(s);
            const isExists = await redisService.sismember(this.clientNetworkUsedList, ip);
            if (!isExists) return s;
        }

        logger.fatal("client ip pool is over");
        throw new RestfullException(500, ErrorCodes.ErrIpAssignFailed, 'ip pool is over');
    }
    async createTunnel(user: User, redisService: RedisService, tunnelKey: string) {
        const key = `/tunnel/${tunnelKey}`;
        const tunnel = await redisService.hgetAll(key) as unknown as Tunnel;
        if (!tunnel || !tunnel.id || !tunnel.clientIp) {
            logger.error(`tunnel not found or some fields are absent => ${tunnel || ''}`);
            throw new RestfullException(401, ErrorCodes.ErrSecureTunnelFailed, 'secure tunnel failed');
        }

        //security check
        if (!tunnel.authenticatedTime) {
            //peer ip must be set before 
            const ip = await this.getEmptyIp(redisService);
            const ipstr = Util.bigIntegerToIp(ip);
            this._lastUsedIp = ip;
            await redisService.hset(key, { assignedClientIp: ipstr, userId: user.id });
            await redisService.sadd(this.clientNetworkUsedList, Util.bigIntegerToIp(ip));
            //all client checking will be over this ip
            //client will set this ip to its interface
            // then will confirm ok
            // and system will prepare additional network settings
            await redisService.set(`/tunnel/${ipstr}`, tunnelKey, { ttl: 5 * 60 * 1000 });


            const authenticationChannel = `/tunnel/authentication/${tunnelKey}`;
            //send every thing ok message to waiting client to finish tunneling
            await redisService.publish(authenticationChannel, 'ok:');
            await redisService.hset(key, { authenticatedTime: new Date().toISOString() });
            await redisService.expire(key, 5 * 60 * 1000);
        }

        return await redisService.hgetAll(key) as unknown as Tunnel;


    }

    /**
     * @summary renew assigned ip
     * @param tunnelKey 
     * @param redisService 
     * @returns 
     */
    async renewIp(tunnelKey: string, redisService: RedisService,) {
        const key = `/tunnel/${tunnelKey}`;
        const tunnel = await redisService.hgetAll(key) as unknown as Tunnel;
        HelperService.isValidTunnel(tunnel);
        const tmp = tunnel.assignedClientIp;
        //peer ip must be set before 
        const ip = await this.getEmptyIp(redisService);
        const ipstr = Util.bigIntegerToIp(ip);
        this._lastUsedIp = ip;
        await redisService.hset(key, { assignedClientIp: ipstr });
        await redisService.sadd(this.clientNetworkUsedList, Util.bigIntegerToIp(ip));
        if (tmp)
            await redisService.sremove(this.clientNetworkUsedList, tmp);
        return await redisService.hgetAll(key) as unknown as Tunnel;

    }

    /**
     * @summary confirm tunnel
     * @param tunnelKey 
     * @param redisService 
     */
    async confirm(tunnelKey: string, redisService: RedisService) {
        const key = `/tunnel/${tunnelKey}`;
        const tunnel = await redisService.hgetAll(key) as unknown as Tunnel;
        HelperService.isValidTunnel(tunnel);
        // add to a list
        await redisService.sadd('/tunnel/configure', tunnel.id || '');
        // and publish to listener for configuring all network settings
        await redisService.publish(`/tunnel/configure`, tunnel.id);
    }

    /**
     * @summary every client sends I am alive request
     * @param tunnelKey 
     * @param redisService 
     */
    async alive(tunnelKey: string, redisService: RedisService) {
        const key = `/tunnel/${tunnelKey}`;
        const tunnel = await redisService.hgetAll(key) as unknown as Tunnel;
        HelperService.isValidTunnel(tunnel);
        //2 important keys for system
        await redisService.expire(key, 3 * 60 * 1000);
        await redisService.expire(`/tunnel/${tunnel.assignedClientIp}`, 3 * 60 * 1000);

    }
}