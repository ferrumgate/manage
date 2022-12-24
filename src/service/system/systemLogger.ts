import { ConfigService } from "../configService";
import { RedisService } from "../redisService";

export interface SystemLog {
    type: string;
    val: any;
}

export class SystemLogger {
    key = '/logs/system';
    /**
     *
     */
    constructor(
        private configService: ConfigService,
        private redis: RedisService,
    ) {


    }

    async save(type: SystemLog) {

    }
}
