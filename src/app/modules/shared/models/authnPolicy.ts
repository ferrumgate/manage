import { AuthenticationProfile, cloneAuthenticatonProfile } from "./authnProfile";



export interface AuthenticationRule {
    id: string;
    name: string;
    networkId: string;
    userOrgroupIds: string[];
    profile: AuthenticationProfile;
    action: 'allow' | 'drop';

}
export function cloneAuthenticationRule(val: AuthenticationRule): AuthenticationRule {
    return {
        id: val.id,
        action: val.action,
        name: val.name,
        networkId: val.networkId,
        userOrgroupIds: val.userOrgroupIds ? Array.from(val.userOrgroupIds) : [],
        profile: cloneAuthenticatonProfile(val.profile)
    }
}


export interface AuthenticationPolicy {
    id: string
    rules: AuthenticationRule[];
    insertDate: string;
    updateDate: string

}