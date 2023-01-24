import { AuthenticationCreds, BufferJSON, initAuthCreds, proto } from '@adiwajshing/baileys';
import { MongoClient } from 'mongodb';

export async function databaseConnect(uri: string): Promise<MongoClient> {
	const client = new MongoClient(uri, {
		compressors: 'zlib',
		zlibCompressionLevel: 5,
		maxConnecting: 10,
	});

	await client.connect();

	return client;
}

export class databaseManager {
	public collection: any;

	constructor(colletion: any) {
		this.collection = colletion;
	}

	writeData = async (data: any, id: any) => {
		try {
			return await this.collection.replaceOne(
				{ _id: id },
				JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
				{ upsert: true }
			);
		} catch (error) {
			return error
		}
	}

	readData = async (id: any) => {
		try {
			return JSON.parse(JSON.stringify(
				await this.collection.findOne({ _id: id })
			), BufferJSON.reviver)
		} catch (error) {
			return error
		}
	}

	removeData = async (id: any) => {
		await this.collection.deleteOne({ _id: id })
	}

	/*
	 * Manager Contacts, Chats and Messages
	 * type: chats, contacts, messages
	 */
	set = async (type: "chats" | "contacts" | "messages", elements: any) => {
		return await this.writeData({ [type]: elements }, type);
	}

	get = async (type: "chats" | "contacts" | "messages", itemId?: string | null, messageId?: string | null) => {
		const records = (await this.readData(type))?.[type] ?? [];

		if (itemId) {
			let item = records.filter(
				(record: any) => record?.id === itemId
					|| record?.name === itemId
					|| record?.key?.remoteJid === itemId
			);

			if (type != 'messages' && item.length) {
				item = item.shift();
			}

			if (type == 'chats' && item?.id) {
				item.messages = await this.get('messages', item.id);
			}

			if (type == 'messages' && messageId) {
				return item.filter(
					(message: any) => message.key.id === messageId
				).shift();
			}

			return item;
		}

		return records;
	}

	update = async (type: "chats" | "contacts" | "messages", elements: any) => {
		const records = await this.get(type);

		if (type == 'messages') {
			for (const element of elements) {
				const index = records.findIndex(
					(record: any) => record?.key?.id === element?.key?.id
				);

				const current = records[index];

				records[index] = {
					...current,
					...element?.update,
				};
			}

			records.sort((a: any, b: any) => (a.messageTimestamp > b.messageTimestamp) ? 1 : -1)
		} else {
			for (const element of elements) {
				const index = records.findIndex(
					(record: any) => record.id === element.id
				);

				const current = records[index];

				records[index] = {
					...current,
					...element,
				};
			}
		}

		await this.set(type, records);

		return records;
	}

	upsert = async (type: "chats" | "contacts", elements: any[]) => {
		for (const element of elements) {
			if (element.id) {
				const record = await this.get(type, element.id);

				if (record) {
					this.update(type, [element]);
				} else {
					const records = await this.get(type);

					records.push(...[element]);

					this.set(type, records);
				}
			}
		}

		return elements;
	}

	upsertMessage = async (element: any) => {
		if (element.key.remoteJid && element.key.id) {
			const message = await this.get('messages', element.key.remoteJid, element.key.id);

			if (message) {
				this.update('messages', [element]);
			} else {
				const records = await this.get('messages');

				records.push(...[element]);

				this.set('messages', records);
			}
		}

		return element;
	}

	remove = async (type: "chats" | "contacts" | "messages", elements: any) => {
		let records = await this.get(type);

		for (const element of elements) {
			records = records.filter(
				(record: any) => {
					return (element?.id ?? element) != (record?.id ?? record?.key?.id)
				}
			);
		}

		await this.set(type, records);
	}
}

export async function useMongoDBAuthState(collection: any) {
	const database = new databaseManager(collection);

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
