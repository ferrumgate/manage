export class UtilService {
    /**
     * creates a random string with 6 length
     */
    static randomNumberString(string_length: number = 16) {


        var chars = "0123456789abcdefghiklmnopqrstuvwxyzABCDEFGHIKLMNOPQRSTUVWXYZ";

        var randomstring = '';
        for (var i = 0; i < string_length; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
        }
        return randomstring;
    }
    static clone<T>(obj: T) {
        return JSON.parse(JSON.stringify(obj)) as T;
    }

    static checkChanged(source?: string[], target?: string[]) {
        if (!target && !source) return false;
        if (!source && target?.length)
            return true;
        if (!target && source?.length)
            return true;
        if (source && target) {
            if (source.length != target.length) return true;
            const founded = source.find(x => !target.includes(x))
            if (founded)
                return true;

        }
        return false;
    }

    static dateFormatDD(date: Date | number) {
        if (typeof date == 'number')
            return new Date(date).getDate().toString();
        return date.getDate().toString();
    }
}