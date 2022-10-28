/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { PlayingMedia } from './media';
import { getBooleanOption } from './parameter-set-util';

import fetch from "node-fetch";
import assert = require("assert");


let DEBUG: boolean;

type SceneDescriptor = {
	buttonId: string;
	elevatorId: string; 
	volume: number;
	rolloffStartDistance: number;
	delay: number;
	height: number;
	width: number;
	speed: number;
	length: number;
	x: number;
	y: number;
	z: number;
	vFX: {
		moveUpSound: string;
		moveDownSound: string;
	};
};

/**
 * The main class of this app. All the logic goes here.
 */
export default class Elevator {
	private state = true;
	private elevatorRoot: MRE.Actor = null;
	private elevator: MRE.Actor = null;
	private button: MRE.Actor = null;
	constructor(
		private context: MRE.Context,
		private params: MRE.ParameterSet
	) {
		DEBUG = getBooleanOption(params, "debug", false);
		this._assets = new MRE.AssetContainer(this.context);

		this.context.onUserJoined((user) => this.userJoined(user));
		this.context.onUserLeft((user) => this.userLeft(user));
		this.context.onStarted(() => this.onStarted());
	}

	private _assets: MRE.AssetContainer = null;
	private sceneDatabase: SceneDescriptor;

	private soundsPath: string[] = [];
	private sounds: { [key: string]: MRE.Sound } = {};
	private soundPlaying: { [key: string]: PlayingMedia } = {};

	private userJoined(user: MRE.User) {
		if (DEBUG) {
			console.debug(
				`Connection request by ${user.name} from ${user.properties.remoteAddress}`
			);
		}
	}
	private userLeft(user: MRE.User) {
		if (DEBUG) {
			console.debug(`Box collider has been removed for ${user.name}`);
		}
	}

	private onStarted() {
		if (this.params.content_pack) {
			fetch(
				"https://account.altvr.com/api/content_packs/" +
					this.params.content_pack +
					"/raw.json"
			)
				.then((res: any) => res.json())
				.then((json: any) => {
					if (DEBUG) {
						console.log(json);
					}
					this.sceneDatabase = Object.assign({}, json);
					this.started();
				});
		}
	}

	private started() {
		const sceneRecord = this.sceneDatabase;
		console.log("sceneRecord: ", sceneRecord);
		for (const audio of Object.values(sceneRecord.vFX)) {
			this.soundsPath.push(audio);
		}
		this.initSoundFX();

		this.elevatorRoot = MRE.Actor.Create(this.context, {
			actor: {
				name: "elevatorRoot",
				transform: {
					local: {
						position: { x: 0, y: 0, z: 0 },
						rotation: { x: 0, y: 0, z: 0 },
						scale: { x: 1, y: 1, z: 1 },
					},
				},
			},
		});

		this.elevator = MRE.Actor.CreateFromLibrary(this.context, {
			resourceId: sceneRecord.elevatorId,
			actor: {
				name: "elevator",
				parentId: this.elevatorRoot.id,
				transform: {
					local: {
						position: { x: 0, y: 0, z: 0 },
						scale: {
							x: sceneRecord.width,
							y: 0.4,
							z: sceneRecord.length,
						},
					},
				},
				collider: {
					geometry: {
						shape: MRE.ColliderType.Box,
						size: {
							x: sceneRecord.width,
							y: 0.5,
							z: sceneRecord.length,
						},
					},
					layer: MRE.CollisionLayer.Navigation,
				},
			},
		});

		this.button = MRE.Actor.CreateFromLibrary(this.context, {
			resourceId: sceneRecord.buttonId,
			actor: {
				name: "button",
				parentId: this.elevator.id,
				transform: {
					local: {
						position: {
							x: sceneRecord.x,
							y: sceneRecord.y,
							z: sceneRecord.z,
						},
						scale: { x: 1, y: 1, z: 1 },
					},
				},
			},
		});

		const buttonB = this.button.setBehavior(MRE.ButtonBehavior);

		buttonB.onClick((_) => {
			this.elevatorAnim();
		});
	}

	private initSoundFX() {
		const baseUrl =
			"https://cdn-content-ingress.altvr.com/uploads/audio_clip/audio";

		this.soundsPath.forEach((sound: string) => {
			this.soundPlaying[sound] = new PlayingMedia();
			this.sounds[sound] = this._assets.createSound(sound, {
				uri: `${baseUrl}/${sound}`,
			});
		});
	}

	private startSound = (
		sound: MRE.Sound,
		actor: MRE.Actor,
		actorRecord: SceneDescriptor
	) => {
		if (this.soundPlaying[sound.name].isLoaded) {
			this.soundPlaying[sound.name].stop();
		}

		assert(!this.soundPlaying[sound.name].isLoaded);
		if (sound !== undefined) {
			const audioOptions: MRE.SetAudioStateOptions = {
				volume: actorRecord.volume,
				looping: false,
				time: 0,
			};

			if (actorRecord.rolloffStartDistance) {
				audioOptions.doppler = 0;
				audioOptions.spread = 0;
				audioOptions.rolloffStartDistance =
					actorRecord.rolloffStartDistance;
			}

			this.soundPlaying[sound.name] = new PlayingMedia(
				(actor || this.elevatorRoot).startSound(sound.id, audioOptions),
				audioOptions
			);
		}

		return;
	};

	private delay(milliseconds: number): Promise<void> {
		return new Promise<void>((resolve) => {
			setTimeout(() => resolve(), milliseconds);
		});
	}

	private async elevatorAnim() {
		const sceneRecord = this.sceneDatabase;
		if (this.state === true) {
			this.state = false;
			const { moveUpSound, moveDownSound } = sceneRecord.vFX;

			this.startSound(
				this.sounds[moveUpSound],
				this.elevator,
				sceneRecord
			);

			await MRE.Animation.AnimateTo(this.context, this.elevator, {
				destination: {
					transform: {
						local: {
							position: { x: 0, y: sceneRecord.height, z: 0 },
						},
					},
				},
				duration: sceneRecord.speed,
				easing: MRE.AnimationEaseCurves.EaseInOutSine,
			});

			await this.delay(sceneRecord.delay * 1000);
			
			this.startSound(
				this.sounds[moveDownSound],
				this.elevator,
				sceneRecord
			);

			await MRE.Animation.AnimateTo(this.context, this.elevator, {
				destination: {
					transform: { local: { position: { x: 0, y: 0, z: 0 } } },
				},
				duration: sceneRecord.speed,
				easing: MRE.AnimationEaseCurves.EaseInOutSine,
			});
			
			this.state = true;
		}
	}
}
