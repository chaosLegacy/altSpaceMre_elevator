/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';

/**
 * The main class of this app. All the logic goes here.
 */
export default class HelloWorld {
	private assets: MRE.AssetContainer;
	private button: MRE.Actor = null;
	private elevator: MRE.Actor = null;
	private config: { [key: string]: number };
	private state = true;
	

	constructor(private context: MRE.Context, private params: MRE.ParameterSet) {
		this.context.onStarted(() => this.started());
	}

	private user: MRE.User;
	/**
	 * Once the context is "started", initialize the app.
	 */
	private started() {
		// set up somewhere to store loaded assets (meshes, textures, animations, gltfs, etc.)
		this.assets = new MRE.AssetContainer(this.context);
		this.config = { "height": 5, "speed": 2, "shape": 0, "width": 0.4, "length": 0.4, "x": 0, "y": 0, "z": 0 };
		for (const key in this.params) {
			this.config[key] = Number(this.params[key]);
		}

		// Load a glTF model before we use it
		const buttonID = "artifact:1765608764049719385";

		// spawn a copy of the glTF model
		this.button = MRE.Actor.CreateFromLibrary(this.context, {
			// using the data we loaded earlier
			resourceId: buttonID,
			// Also apply the following generic actor properties.
			actor: {
				name: "Altspace Cube",
				// Parent the glTF model to the text actor, so the transform is relative to the text
				transform: {
					local: {
						position: { x: -2.5 + this.config["x"], y: 0 + this.config["y"], z: 0.50 + this.config["z"] },
						scale: { x: 0.4, y: 0.4, z: 0.4 }
					}
				}
			}
		});

		let resourceID: string;
		const shape = this.config["shape"];
		switch(shape) {
			case 0:
				resourceID = "artifact:1765571507825672216";
				break;
			case 1:
				resourceID = "artifact:1765571516868591649";
				break;
			case 2:
				resourceID = "artifact:1765571499302846486";
				break;
			default:
				resourceID = "artifact:1765571490788409362";
		}
		this.elevator = MRE.Actor.CreateFromLibrary(this.context, {
			// using the data we loaded earlier
			resourceId: resourceID,
			// Also apply the following generic actor properties.
			actor: {
				name: "Altspace Cube",
				// Parent the glTF model to the text actor, so the transform is relative to the text
				transform: {
					local: {
						position: { x: 0, y: 0, z: 0 },
						scale: { x: this.config["width"], y: 0.4, z: this.config["length"] }
					}
				},
				collider: {
					geometry: {
						shape: MRE.ColliderType.Box,
						size: { x: 1.6 + this.config["width"], y: 0.5, z: 1.6 + this.config["length"] }
					},
					layer: MRE.CollisionLayer.Navigation
				}
			}
		});

		const buttonB = this.button.setBehavior(MRE.ButtonBehavior);

		buttonB.onClick(_ => {
			this.elevatorAnim()
		});

	}
	private async elevatorAnim() {
		if (this.state === true) {
			this.state= false;
			await MRE.Animation.AnimateTo(this.context, this.elevator, {
				destination: { transform: { local: { position: { x: 0, y: this.config["height"], z: 0 } } } },
				duration: this.config["speed"]
			});
			await this.sleep((this.config["speed"] + 4) * 1000);
			await MRE.Animation.AnimateTo(this.context, this.elevator, {
				destination: { transform: { local: { position: { x: 0, y: 0, z: 0 } } } },
				duration: 1
			});
			this.state=true;
		}

	}
	private sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
