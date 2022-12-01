
import { HelperService } from "../../service/helperService";
import { BaseAuth } from "../../model/authSettings";
import { User } from "../../model/user";
import { RestfullException } from "../../restfullException";
import { ErrorCodes } from "../../restfullException";
import { Util } from "../../util";
import { AuthSession } from "../../model/authSession";
import { RedisService } from "../../service/redisService";
import { logger } from "../../common";
import { AppService } from "../../service/appService";
import { ActivitiyStatus, ActivityLog } from "../../model/activityLog";

/**
 * common user checking function
 * @param user 
 */
export async function checkUser(user?: User, baseAuth?: BaseAuth) {
    if (!user || !baseAuth)
        throw new RestfullException(401, ErrorCodes.ErrBadArgument, "not authenticated");
    HelperService.isValidUser(user);
    HelperService.isFromSource(user, `${baseAuth.baseType}-${baseAuth.type}`);

}

/**
 * @summary create an activity object if not exists on request and set auth source
 */
export function attachActivitySource(req: any, authSource: string) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    req.activity.authSource = authSource;
    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}
/**
 * @summary create an activity object if not exists on request and set username
 */
export function attachActivityUsername(req: any, username?: string) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    req.activity.username = username;
    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}

/**
 * @summary create an activity object if not exists on request and set user
 */
export function attachActivityUser(req: any, user?: User) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    req.activity.user = user;
    req.activity.username = user?.username;
    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}

/**
 * @summary create an activity object if not exists on request and set user
 */
export function attachActivitySessionId(req: any, id?: string) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    req.activity.sessionId = id;
    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}
/**
 * @summary create an activity object if not exists on request and set user
 */
export function attachActivityTunnelId(req: any, id?: string) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    req.activity.tunnelId = id;
    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}

/**
 * @summary create an activity object if not exists on request and set user
 */
export function attachActivity(req: any, activity?: any) {
    //important we need to know where auth comes
    if (!req.activity)
        req.activity = {};
    if (activity) {
        req.activity = {
            ...req.activity,
            ...activity
        }
    }

    // follow request
    req.activity.requestId = req.activity.requestId || Util.randomNumberString(64);
    req.activity.clientIp = req.activity.clientIp || req.clientIp;

}


export async function saveActivityError(req: any, type: string, err: any, extFunc?: (log: ActivityLog) => void) {
    try {

        const appService = req.appService as AppService;
        const activityService = appService.activityService;
        const act = req.activity;
        const activity: ActivityLog = {
            requestId: act.requestId || Util.randomNumberString(64),
            type: type,
            username: act.username || '',
            authSource: act.authSource || 'unknown',
            insertDate: new Date().toISOString(),
            ip: act.clientIp || req.clientIp,
            status: ActivitiyStatus.Success,
            userId: act.user?.id,
            user2FA: act.user?.is2FA,//user needs 2FA            
            sessionId: act.sessionId,
            requestPath: req.path
        }

        if (err instanceof RestfullException) {
            activity.status = err.status;
            activity.statusMessage = err.code;
            //activity.statusMessage2=err.:
            //TODO
        }
        else if (err instanceof Error) {
            activity.status = 500;
            activity.statusMessage = err.message;
        }
        if (extFunc)
            extFunc(activity);
        await activityService.save(activity);
    } catch (err) {
        logger.fatal(err);
    }

}


export async function saveActivity(req: any, type: string, extFunc?: (log: ActivityLog) => void) {
    try {

        const appService = req.appService as AppService;
        const activityService = appService.activityService;
        const act = req.activity;
        const activity: ActivityLog = {
            requestId: act.requestId || Util.randomNumberString(64),
            type: type,
            username: act.username || 'unknown',
            userId: act.user?.id,
            user2FA: act.user?.is2FA,//user needs 2FA
            authSource: act.authSource || 'unknown',
            insertDate: new Date().toISOString(),
            ip: act.clientIp || req.clientIp,
            status: ActivitiyStatus.Success,
            sessionId: act.sessionId,
            requestPath: req.path
        }
        if (extFunc)
            extFunc(activity);

        await activityService.save(activity);
    } catch (err) {
        logger.fatal(err);
    }

}


