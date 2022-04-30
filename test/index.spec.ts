
import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { app } from '../src/index';


chai.use(chaiHttp);
const expect = chai.expect;




describe('index testing application', async () => {



    it('GET /test', async () => {

        let response: any = await new Promise((resolve: any, reject: any) => {
            chai.request(app)
                .get('/test')
                .end((err, res) => {
                    if (err)
                        reject(err);
                    else
                        resolve(res);

                });

        })

        expect(response.status).to.equal(200);

    }).timeout(5000);

})


