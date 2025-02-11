import { spawn } from "node:child_process";

export type VideoMetadata = {
	streams: Stream[];
	format: Format;
};

type Stream = {
	index: number;
	codec_name: string;
	codec_long_name: string;
	profile?: string;
	codec_type: "video" | "audio";
	codec_tag_string: string;
	codec_tag: string;
	width?: number;
	height?: number;
	coded_width?: number;
	coded_height?: number;
	closed_captions?: number;
	film_grain?: number;
	has_b_frames?: number;
	sample_aspect_ratio?: string;
	display_aspect_ratio?: string;
	pix_fmt?: string;
	level?: number;
	color_range?: string;
	color_space?: string;
	color_transfer?: string;
	color_primaries?: string;
	chroma_location?: string;
	field_order?: string;
	refs?: number;
	id: string;
	r_frame_rate: string;
	avg_frame_rate: string;
	time_base: string;
	start_pts: number;
	start_time: string;
	duration_ts: number;
	duration: string;
	bit_rate: string;
	nb_frames: string;
	extradata_size: number;
	disposition: Disposition;
	tags: StreamTags;
	// Audio-specific properties
	sample_fmt?: string;
	sample_rate?: string;
	channels?: number;
	channel_layout?: string;
	bits_per_sample?: number;
	initial_padding?: number;
};

type Disposition = {
	default: number;
	dub: number;
	original: number;
	comment: number;
	lyrics: number;
	karaoke: number;
	forced: number;
	hearing_impaired: number;
	visual_impaired: number;
	clean_effects: number;
	attached_pic: number;
	timed_thumbnails: number;
	non_diegetic: number;
	captions: number;
	descriptions: number;
	metadata: number;
	dependent: number;
	still_image: number;
	multilayer: number;
};

type StreamTags = {
	language: string;
	handler_name: string;
	vendor_id: string;
	encoder?: string;
};

type Format = {
	filename: string;
	nb_streams: number;
	nb_programs: number;
	nb_stream_groups: number;
	format_name: string;
	format_long_name: string;
	start_time: string;
	duration: string;
	size: string;
	bit_rate: string;
	probe_score: number;
	tags: FormatTags;
};

type FormatTags = {
	major_brand: string;
	minor_version: string;
	compatible_brands: string;
	date: string;
	encoder: string;
};

export const qualities = {
	av1: [
		{
			name: "av1_1080p",
			scale: "scale=-2:1080",
			crf: "35",
			codec: "libsvtav1",
			preset: "5",
			// svtParams: "mbr=10000k",
		},
		{
			name: "av1_720p",
			scale: "scale=-2:720",
			crf: "36",
			codec: "libsvtav1",
			preset: "6",
			// svtParams: "mbr=5500k",
		},
		{
			name: "av1_360p",
			scale: "scale=-2:360",
			crf: "36",
			codec: "libsvtav1",
			preset: "6",
			// svtParams: "mbr=1000k",
		},
	],
	x264: [
		{
			name: "264_1080p",
			scale: "scale=-2:1080",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "4000K", maxrate: "4000K", bufsize: "4000K" },
		},
		{
			name: "264_720p",
			scale: "scale=-2:720",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "1500K", maxrate: "1500K", bufsize: "1500K" },
		},
		{
			name: "264_360p",
			scale: "scale=-2:360",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "400K", maxrate: "400K", bufsize: "400K" },
		},
	],
};

export async function runFFmpeg({
	input,
	output,
	commands,
	onProgress,
}: {
	input: string;
	output: string;
	commands: string[];
	onProgress?: (progress: number, estimatedTimeRemaining: string) => void;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if ffmpeg is installed
		const versionCheck = spawn("ffmpeg", ["-version"]);
		versionCheck.on("error", () => {
			reject(new Error("FFmpeg is not installed or not accessible"));
			return;
		});

		let errorMessage = "";
		const args = ["-y", "-i", input, ...commands, output];
		console.info("FFMpeg Arguments", args.join(" "));
		const ffmpeg = spawn("ffmpeg", args);
		const startTime = Date.now();
		let durationSeconds = 0;
		let currentTime = 0;

		// Capture error output
		ffmpeg.stderr.setEncoding("utf8");
		ffmpeg.stderr.on("data", (data: string) => {
			const dataStr = data.toString();
			errorMessage += dataStr; // Collect error messages

			// Duration parsing
			const durationMatch = dataStr.match(
				/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/,
			);
			if (durationMatch) {
				const hours = Number.parseFloat(durationMatch[1]);
				const minutes = Number.parseFloat(durationMatch[2]);
				const seconds = Number.parseFloat(durationMatch[3]);
				durationSeconds = hours * 3600 + minutes * 60 + seconds;
			}

			// Progress parsing
			const timeMatch = dataStr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
			if (timeMatch) {
				const hours = Number.parseFloat(timeMatch[1]);
				const minutes = Number.parseFloat(timeMatch[2]);
				const seconds = Number.parseFloat(timeMatch[3]);
				currentTime = hours * 3600 + minutes * 60 + seconds;

				if (durationSeconds) {
					const progress = (currentTime / durationSeconds) * 100;
					const elapsedTime = (Date.now() - startTime) / 1000;
					const estimatedTotalTime = elapsedTime / (progress / 100);
					const estimatedTimeRemaining = estimatedTotalTime - elapsedTime;
					const formattedEtr = formatTime(estimatedTimeRemaining);
					if (onProgress) {
						if (progress > 0.2) {
							onProgress(Math.floor(progress), formattedEtr);
						}
					}
				}
			}
		});

		ffmpeg.on("error", (error) => {
			console.error("Error occurred in FFmpeg process:", error);
			reject(
				new Error(`FFmpeg process error: ${error.message}\n${errorMessage}`),
			);
		});

		ffmpeg.on("close", (code) => {
			if (code === 0) {
				if (onProgress) {
					onProgress(100, "00:00:00");
				}
				resolve();
			} else {
				console.error("FFmpeg stderr output:", errorMessage);
				reject(
					new Error(
						`FFmpeg exited with code ${code}. Error output: ${errorMessage}`,
					),
				);
			}
		});

		// Validate input file exists
		ffmpeg.stdin.on("error", (error) => {
			reject(new Error(`Input file error: ${error.message}`));
		});
	});
}

export async function getMediaInfo(
	input: string,
): Promise<VideoMetadata | undefined> {
	return new Promise((resolve, reject) => {
		const args = [
			"-v",
			"quiet",
			"-print_format",
			"json",
			"-show_format",
			"-show_streams",
			"-show_entries",
			"stream_tags:format_tags",
			input,
		];
		const ffprobe = spawn("ffprobe", args);

		let outputBuffer = "";
		let errorBuffer = "";

		ffprobe.stdout.on("data", (data: Buffer) => {
			outputBuffer += data.toString();
		});

		ffprobe.stderr.on("data", (data: Buffer) => {
			errorBuffer += data.toString();
		});

		ffprobe.on("close", (code: number) => {
			if (code === 0) {
				try {
					const parsedOutput = JSON.parse(outputBuffer);
					resolve(parsedOutput);
				} catch (parseError: any) {
					reject(
						new Error(
							`Failed to parse ffprobe output: ${parseError.message}. Raw output: ${outputBuffer}`,
						),
					);
				}
			} else {
				reject(new Error(`ffprobe exited with code ${code}: ${errorBuffer}`));
			}
		});
	});
}

// export async function getMediaInfo(
// 	input: string,
// ): Promise<VideoMetadata | undefined> {
// 	return new Promise((resolve, reject) => {
// 		let outputBuffer = "";
// 		let errorBuffer = "";

// 		const ffprobe = spawn("ffprobe", [
// 			"-v",
// 			"quiet",
// 			"-print_format",
// 			"json",
// 			"-show_format",
// 			"-show_streams",
// 			input,
// 		]);

// 		ffprobe.stdout.on("data", (data) => {
// 			outputBuffer += data.toString();
// 		});

// 		ffprobe.stderr.on("data", (data) => {
// 			errorBuffer += data.toString();
// 		});

// 		ffprobe.on("close", (code) => {
// 			if (code === 0) {
// 				try {
// 					const parsedOutput = JSON.parse(outputBuffer);
// 					resolve(parsedOutput);
// 				} catch (error) {
// 					reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
// 				}
// 			} else {
// 				reject(new Error(`ffprobe exited with code ${code}: ${errorBuffer}`));
// 			}
// 		});

// 		ffprobe.on("error", (error) => {
// 			reject(new Error(`Failed to start ffprobe: ${error.message}`));
// 		});
// 	});
// }

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return [h, m, s].map((v) => (v < 10 ? "0" + v : v)).join(":");
}
