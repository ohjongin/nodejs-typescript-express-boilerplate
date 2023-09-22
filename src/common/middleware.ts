import { BaseController } from './base/base.controller';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3 } from './aws';
import env from '../env';
import logger from '../lib/logger';
import appRoot from 'app-root-path';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getValidFilename } from '../lib/hangul';

export default class Middleware extends BaseController {
    private S3SignupDocsStorage = multerS3({
        s3: s3,
        acl: 'bucket-owner-full-control',
        bucket: `${env.aws.s3.docs.bucket}`,
        key: function (req, file, cb) {
            logger.debug(`S3SignupDocsStorage file received: ${file.originalname}`);
            file.originalname = getValidFilename(file.originalname);
            logger.debug(`diskStorage file converted: ${file.originalname}`);

            const filename = file.originalname;
            const ext = path.extname(filename);
            const extname = ext?.length > 1 ? ext : '';
            const uuid = uuidv4();
            const signup = JSON.parse(req.body.signup);
            const key = `${env.aws.s3.docs.path}/${env.mode.value}/${signup.company.number}/${uuid}${extname}`;
            logger.debug(`S3SignupDocsStorage file uploaded: ${JSON.stringify(key)}`);
            cb(null, key);
        }
    });

    private diskStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(appRoot.path, 'temp');
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }

            cb(null, dir)
        },
        // @ts-ignore
        filename: function (req, file, cb) {
            logger.debug(`diskStorage file received: ${file.originalname}`);
            file.originalname = getValidFilename(file.originalname);
            logger.debug(`diskStorage file converted: ${file.originalname}`);
            const key = file.originalname;
            cb(null, key);
        },
    })

    uploadS3SignupDocs = multer({
        storage: this.S3SignupDocsStorage,
        /*fileFilter: function (req, file, callback) {
            const mime = file.mimetype;
            const ext = path.extname(file.originalname);
            const allowed = ['.png', '.jpg', '.gif', '.jpeg', '.jfif', '.pjpeg', '.pjp'];

            return allowed.some( e => e === ext) ? callback(null, true) : callback(new Error('Only images are allowed'))
        },*/
    });

    uploadDiskStorage = multer({
        // multers disk storage settings
        storage: this.diskStorage,
        // SonarQube Issue
        // Rejecting requests with significant content length is a good practice
        // to control the network traffic intensity and thus resource consumption in order to prevents DoS attacks.
        limits: { fileSize: 8 * 1024 * 1024 }
    });

    private S3ImageUploadStorage = multerS3({
        s3: s3,
        acl: 'public-read',
        bucket: `${env.aws.s3.cdn.bucket}`,
        // bucket: `${env.aws.s3.images.bucket}`,
        key: function (req, file, cb) {
            logger.log(`origin: ${file.originalname}`);
            file.originalname = getValidFilename(file.originalname);
            logger.log(`convert: ${file.originalname}`);

            const filename = file.originalname;
            const ext = path.extname(filename);
            const extname = ext?.length > 1 ? ext : '';
            const uuid = uuidv4();

            const key = `${env.aws.s3.images.path}/${env.mode.value}/${uuid}${extname}`;
            logger.log(`S3ImageUploadStorage file uploaded: ${JSON.stringify(key)}`);
            cb(null, key);
        },
    });

    uploadS3Image = multer({
        storage: this.S3ImageUploadStorage,
    });
}
