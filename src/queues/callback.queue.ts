// import Queue from 'bull';
// import logger from '../config/logger';
// import { JumpsellerService, JumpsellerCallbackParams } from '../services/jumpseller.service';
// import prisma from '../config/database';
//
// export interface CallbackJobData {
//   orderId: string;
//   callbackUrl: string;
//   params: JumpsellerCallbackParams;
// }
//
// export const callbackQueue = new Queue('jumpseller-callbacks', {
//   redis: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT || '6379'),
//   },
// });
//
//
// callbackQueue.process(async (job) => {
//   const { orderId, callbackUrl, params }: CallbackJobData = job.data;
//
//   logger.info('Processing callback job', {
//     jobId: job.id,
//     orderId,
//     callbackUrl,
//     result: params.x_result,
//     attempt: job.attemptsMade + 1,
//   });
//
//   try {
//
//     const response = await JumpsellerService.sendCallback(callbackUrl, params);
//
//
//     await prisma.callbackRetry.create({
//       data: {
//         orderId,
//         callbackUrl,
//         attemptNumber: job.attemptsMade + 1,
//         statusCode: response.statusCode,
//         responseBody: response.responseBody,
//         nextRetryAt: response.success ? null : new Date(Date.now() + (2000 * Math.pow(2, job.attemptsMade))),
//       },
//     });
//
//     if (!response.success) {
//
//       throw new Error(`Callback failed with status ${response.statusCode}: ${response.responseBody}`);
//     }
//
//     logger.info('Callback job completed successfully', {
//       jobId: job.id,
//       orderId,
//       statusCode: response.statusCode,
//     });
//
//     return response;
//
//   } catch (error) {
//     logger.error('Callback job failed', {
//       jobId: job.id,
//       orderId,
//       attempt: job.attemptsMade + 1,
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//
//
//     await prisma.callbackRetry.create({
//       data: {
//         orderId,
//         callbackUrl,
//         attemptNumber: job.attemptsMade + 1,
//         statusCode: null,
//         responseBody: error instanceof Error ? error.message : 'Unknown error',
//         nextRetryAt: new Date(Date.now() + (2000 * Math.pow(2, job.attemptsMade))),
//       },
//     });
//
//     throw error;
//   }
// });
//
//
// callbackQueue.on('completed', (job, result) => {
//   logger.info('Callback job completed', {
//     jobId: job.id,
//     orderId: job.data.orderId,
//     processingTime: Date.now() - job.timestamp,
//   });
// });
//
// callbackQueue.on('failed', (job, err) => {
//   logger.error('Callback job failed permanently', {
//     jobId: job.id,
//     orderId: job.data.orderId,
//     attempts: job.attemptsMade,
//     error: err.message,
//   });
// });
//
// callbackQueue.on('stalled', (job) => {
//   logger.warn('Callback job stalled', {
//     jobId: job.id,
//     orderId: job.data.orderId,
//   });
// });
//
//
// export const addCallbackJob = (data: CallbackJobData) => {
//   return callbackQueue.add(data, {
//     attempts: 3,
//     backoff: {
//       type: 'exponential',
//       delay: 2000,
//     },
//     removeOnComplete: 10,
//     removeOnFail: 10,
//   });
// };
//
// export default callbackQueue;
