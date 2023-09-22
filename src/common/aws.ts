import {GetObjectCommand, GetObjectTaggingCommand, PutObjectTaggingCommand, S3Client} from '@aws-sdk/client-s3';
import {SendMessageCommand, SQSClient} from '@aws-sdk/client-sqs';
import env from '../env';
import logger from '../lib/logger';
import {Upload} from '@aws-sdk/lib-storage';
import fs from 'fs';
import {assertTrue, handleSentry} from '../lib/utils';
import ApiError from './api.error';
import ApiCodes from './api.codes';
import ApiMessages from './api.messages';
import stream from 'stream';
import path from 'path';
import {getValidFilename} from '../lib/hangul';

const config = {
    region: 'ap-northeast-2',
    apiVersion: '2006-03-01',
    credentials: {
        accessKeyId : env.aws.key.id,
        secretAccessKey: env.aws.key.secret
    }
};

export const s3 = new S3Client(config);
export const sqs =  new SQSClient(config);

export const sendSqsMessage = (message) => {
    if (!env.aws.sqs.queue.url) return;

    // JSON CURRENT_TIMESTAMP 로 등록 방지
    message.instance.created_at = new Date();
    message.instance.create_timestamp = Math.floor(new Date().getTime() / 1000);
    delete message.instance.snapshot?.detail;
    delete message.instance.product?.detail;
    delete message.instance.detail;

    sqs.send(new SendMessageCommand({
        MessageBody: JSON.stringify(message),
        QueueUrl: env.aws.sqs.queue.url,
    })).then((data) => {
        // process data.
    }).catch((error) => {
        logger.error(error);
        handleSentry('error', error);
    }).finally(() => {
        // finally.
    });
}

export const uploadToS3 = async (filePath, bucket, key) => {
    assertTrue(fs.existsSync(filePath), new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST), {
        message: `File not found: ${filePath}`
    })

    const pass = new stream.PassThrough();
    const readableStream = fs.createReadStream(filePath);

    let res, tagValue;
    try {
        const basename = path.basename(filePath);
        const filename = getValidFilename(basename);

        tagValue = filename.substring(0, Math.min(basename.length, 255));
        logger.debug(`uploadToS3() => filePath:${filePath}, bucket:${bucket}, key:${key}, basename:${basename}, filename:${filename}, tagValue:${tagValue}`);

        const S3Upload = new Upload({
            client: s3,
            params: {
                Bucket: bucket,
                Key: key,
                Body: pass,
                ACL: 'bucket-owner-full-control',
            },
            tags: [
                {
                    Key: 'Name',
                    Value: tagValue
                }
            ],
            queueSize: 4,
            partSize: 1024 * 1024 * 5,
            leavePartsOnError: false,
        });

        readableStream.pipe(pass);
        res = await S3Upload.done();
        logger.debug(`uploadFileToS3() => ${JSON.stringify(res)}`);
    } catch (e) {
        logger.error(JSON.stringify(e));
        logger.error(e);
        handleSentry('ERROR', e);
    }

    return res;
}

export const downloadFromS3 = async (bucket, key): Promise<ReadableStream> => {
    let fileStream;

    try {
        logger.debug(`downloadFromS3() => bucket:${bucket}, key:${key}`);
        const obj = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });
        const s3Item = await s3.send(obj);
        fileStream = s3Item.Body;
    } catch (e) {
        logger.error(JSON.stringify(e));
        logger.error(e);
        handleSentry('ERROR', e);
    }

    return fileStream;
}

export const getObjectTags = async (bucket, key) => {
    let res;

    try {
        const tag = new GetObjectTaggingCommand({
            Bucket: bucket,
            Key: key,
        });
        // @ts-ignore
        res = await s3.send(tag);
    } catch (e) {
        logger.error(JSON.stringify(e));
        logger.error(e);
        handleSentry('ERROR', e);
    }

    return res?.TagSet;
}

export const setObjectTags = async (file) => {
    let res;

    try {
        const bucket = file.bucket;
        const key = file.key;
        const input = { // PutObjectTaggingRequest
            Bucket: bucket, // required
            Key: key, // required
            Tagging: { // Tagging
                TagSet: [ // TagSet // required
                    { // Tag
                        Key: "Name", // required
                        Value: encodeURI(file.originalname), // required
                    },
                ],
            },
        };
        const command = new PutObjectTaggingCommand(input);
        // @ts-ignore
        res = await s3.send(command);
    } catch (e) {
        logger.error(JSON.stringify(e));
        logger.error(e);
        handleSentry('ERROR', e);
    }

    return res;
}