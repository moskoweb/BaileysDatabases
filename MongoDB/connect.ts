import { MongoClient } from 'mongodb';
import { BufferJSON, initAuthCreds, proto } from '@adiwajshing/baileys';

export async function databaseConnect() {
	let client = new MongoClient(process.env.MONGODB_URI)

	await client.connect()

	return client;
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
		)
	}

	readData = async (id: any) => {
		try {
			const data = JSON.stringify(await this.collection.findOne({ _id: id }))
			return JSON.parse(data, BufferJSON.reviver)
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

	const creds = await database.readData('creds') ?? initAuthCreds();

	return {
		state: {
			creds,
			keys: {
				get: async (type: any, ids: any) => {
					const data: any = {}
					await Promise.all(
						ids.map(async (id: any) => {
							let value = await database.readData(`${type}-${id}`)
							if (type === 'app-state-sync-key') {
								value =
									proto.Message.AppStateSyncKeyData.fromObject(data)
							}
							data[id] = value
						})
					)
					return data
				},

				set: async (data: any) => {
					const tasks = []
					for (const category of Object.keys(data)) {
						for (const id of Object.keys(data[category])) {
							const value = data[category][id]
							const key = `${category}-${id}`
							tasks.push(
								value ? database.writeData(value, key) : database.removeData(key)
							)
						}
					}
					await Promise.all(tasks)
				},
			},
		},

		saveCreds: () => {
			return database.writeData(creds, 'creds')
		},
	}
}
