import * as path from 'path';
import * as fs from 'fs-extra';

import { v4 as uuid } from 'uuid';
import { FlowProducer, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JOB_FLOWS, JOB_QUEUES } from '../types';
import { createFFMpeg } from '../utils/ffmpeg';
import {
  ConcatenationJobInputs,
  SegmentationJobInputs,
  TranscodeJobInputs,
} from '../jobs/dto/create-job.dto';
import { InjectFlowProducer, Processor, WorkerHost } from '@nestjs/bullmq';

@Processor(JOB_QUEUES.SEGMENTATION)
export class SegmentationProcessor extends WorkerHost {
  constructor(
    private configService: ConfigService,
    @InjectFlowProducer(JOB_FLOWS.CHUNKED_TRANSCODE)
    private transcodeFlow: FlowProducer,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<any> {
    const jobData = job.data as SegmentationJobInputs;
    const tidalDir = this.configService.get('TIDAL_DIR');

    // Setting up directories
    const assetId = uuid();
    const transcodingDir = path.normalize(`${tidalDir}/tmp/${assetId}`);
    const sourceSegmentsDir = path.normalize(
      `${transcodingDir}/segments/source`,
    );
    await fs.ensureDir(sourceSegmentsDir);
    const transcodedSegmentsDir = path.normalize(
      `${transcodingDir}/segments/transcoded`,
    );
    await fs.ensureDir(transcodedSegmentsDir);

    // setting up paths
    const sourceInput = path.normalize(`${tidalDir}/${jobData.input}`);
    const transcodedAudioPath = path.normalize(`${transcodingDir}/audio.ogg`);
    const transcodedVideoPath = path.normalize(`${tidalDir}/${jobData.output}`);

    // Segment the input file into 60 second chunks
    await new Promise((resolve, reject) => {
      const args = [
        '-i',
        sourceInput,
        '-c',
        'copy',
        '-an',
        '-segment_time',
        jobData?.segmentation_options?.segment_time || '30',
        '-f',
        'segment',
        `${sourceSegmentsDir}/%07d.mkv`,
      ];
      const ffmpegProcess = createFFMpeg(args);
      ffmpegProcess.on('progress', (progress: number) => {
        console.log(`Progress`, { progress });
      });
      ffmpegProcess.on('success', (res) => {
        console.log('Conversion successful');
        resolve(res);
      });
      ffmpegProcess.on('error', (error: Error) => {
        console.error(`Conversion failed: ${error.message}`);
        reject('Conversion failed');
      });
    });

    const sourceSegments = await fs.readdir(sourceSegmentsDir);
    const segmentTranscodeChildJobs = sourceSegments.map((segment) => {
      return {
        name: 'transcode',
        data: {
          input: `${sourceSegmentsDir}/${segment}`,
          output: `${transcodedSegmentsDir}/${segment}`,
          command: jobData.command,
        } as TranscodeJobInputs,
        queueName: JOB_QUEUES.TRANSCODE,
      };
    });

    const audioTranscodeChildJobs = [
      {
        name: 'transcode',
        data: {
          input: sourceInput,
          output: transcodedAudioPath,
          command: '-c:a libopus -b:a 128k -vn',
        } as TranscodeJobInputs,
        queueName: JOB_QUEUES.TRANSCODE,
      },
    ];

    await this.transcodeFlow.add({
      name: 'concatenate',
      queueName: JOB_QUEUES.CONCATENATION,
      data: {
        audio: transcodedAudioPath,
        segments: segmentTranscodeChildJobs.map(({ data }) => {
          return data.output;
        }),
        output: transcodedVideoPath,
      } as ConcatenationJobInputs,
      children: [...audioTranscodeChildJobs, ...segmentTranscodeChildJobs],
    });

    console.info('done');
  }
}
