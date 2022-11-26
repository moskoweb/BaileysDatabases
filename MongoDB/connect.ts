import { AuthenticationCreds, BufferJSON, initAuthCreds, proto } from '@adiwajshing/baileys';
import { MongoClient } from 'mongodb';

export async function databaseConnect(uri: string) {
	let client = new MongoClient(uri)

	await client.connect()

	return client
}

export class databaseManager {
	public collection: any;

	constructor(colletion: any) {
		this.collection = colletion;
	}

	writeData = (data: any, id: any) => {
		return this.collection.replaceOne(
			{ _id: id },
			JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
			{ upsert: true }
		);
	}

	readData = async (id: any) => {
		try {
			return JSON.parse(JSON.stringify(
				await this.collection.findOne({ _id: id })
			), BufferJSON.reviver)
		} catch (error) {
			return null
		}
	}

	removeData = async (id: any) => {
		await this.collection.deleteOne({ _id: id })
	}
}

export async function useMongoDBAuthState(collection: any) {
	var database = new databaseManager(collection);

	const creds: AuthenticationCreds = await database.readData('creds') || initAuthCreds()

	return {
		state: {
			creds,
			keys: {
				get: async (type: any, ids: any) => {
					const data: any = {}
					await Promise.all(
						ids.map(async (id: any) => {
							let value = await database.readData(`${type}-${id}`)
							if (type === 'app-state-sync-key' && value) {
								value = proto.Message.AppStateSyncKeyData.fromObject(value)
							}

							data[id] = value
						})
					)

					return data
				},

				set: async (data: any) => {
					const tasks: Promise<void>[] = []
					for (const category in data) {
						for (const id in data[category]) {
							const value = data[category][id]
							const key = `${category}-${id}`

							tasks.push(
								value
									? database.writeData(value, key)
									: database.removeData(key)
							)
						}
					}

					await Promise.all(tasks)
				},
			},
		},

		saveCreds: () => {
			return database.writeData(creds, 'creds');
		},
	}
}
