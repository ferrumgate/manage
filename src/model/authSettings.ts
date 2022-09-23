

export interface AuthGoogle {
    clientID: string,
    clientSecret: string,
    //callbackURL: string will  be ${url}/login/google/callback
}
export interface AuthLinkedIn {
    clientID: string,
    clientSecret: string,
    //callbackURL: string will  be ${url}/login/linkedin/callback
}

export interface AuthLocal {
    isForgotPassword?: number;
    isRegister?: number;
}

export interface AuthSettings {
    google?: AuthGoogle,
    linkedin?: AuthLinkedIn,
    local: AuthLocal;
}