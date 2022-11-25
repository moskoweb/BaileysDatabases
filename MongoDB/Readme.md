# Como Usar

```ts
// Imports
import { databaseConnect, useMongoDBAuthState } from "./utils/mongoConnect";

// Connect
var client = await databaseConnect('MONGO_URI');
var database = client.db('DATABASE');

// Autentication
var dbManager = new databaseManager(database.collection('COLLECTION'));
var authState = await useMongoDBAuthState(this.database.collection);

// Read Data
var chats = await dbManager.readData('chats');
var contacts = await dbManager.readData('contacts');
var messages = await dbManager.readData('messages');

// Write Data
dbManager.writeData({chats: this.chats}, 'chats');
dbManager.writeData({contacts: this.contacts}, 'contacts');
dbManager.writeData({messages: this.messages}, 'messages');

// Remove Data
dbManager.removeData({chats: this.chats}, 'chats');
dbManager.removeData({contacts: this.contacts}, 'contacts');
dbManager.removeData({messages: this.messages}, 'messages');
```
