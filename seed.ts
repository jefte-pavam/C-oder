import Database from "better-sqlite3";

const db = new Database("caoder.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    avatar TEXT,
    emoji TEXT,
    bio TEXT
  );

  CREATE TABLE IF NOT EXISTS dogs (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    name TEXT,
    breed TEXT,
    age TEXT,
    photos TEXT,
    behavior TEXT,
    bio TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    adopter_id TEXT,
    dog_id TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(adopter_id) REFERENCES users(id),
    FOREIGN KEY(dog_id) REFERENCES dogs(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    sender_id TEXT,
    content TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(match_id) REFERENCES matches(id)
  );
`);

const breeds = [
  'Golden Retriever', 'Labrador', 'Poodle', 'Bulldog Francês', 'Beagle', 
  'Pastor Alemão', 'Chihuahua', 'Pug', 'Rottweiler', 'Boxer', 
  'Dachshund', 'Yorkshire Terrier', 'Shih Tzu', 'Border Collie', 'Cocker Spaniel',
  'Vira-lata (SRD)', 'Dalmata', 'Husky Siberiano', 'Pinscher', 'Basset Hound'
];

const names = [
  'Bento', 'Mel', 'Thor', 'Luna', 'Buddy', 'Amora', 'Max', 'Bella', 'Charlie', 'Lola',
  'Rocky', 'Maya', 'Toby', 'Nina', 'Cooper', 'Pipoca', 'Zeus', 'Cacau', 'Simba', 'Gaia',
  'Bob', 'Pandora', 'Fred', 'Bela', 'Marley', 'Julie', 'Billy', 'Kiwi', 'Jack', 'Jade',
  'Luke', 'Zoe', 'Dante', 'Sofia', 'Apollo', 'Bibi', 'Nico', 'Malu', 'Theo', 'Lulu',
  'Ozzy', 'Cléo', 'Bruno', 'Duda', 'Rex', 'Pérola', 'Tico', 'Frida', 'Guga', 'Lica'
];

const ages = ['3 meses', '6 meses', '1 ano', '2 anos', '3 anos', '4 anos', '5 anos', '7 anos', '10 anos'];

const seedDogs = Array.from({ length: 50 }).map((_, i) => {
  const breed = breeds[Math.floor(Math.random() * breeds.length)];
  const name = names[i % names.length];
  const age = ages[Math.floor(Math.random() * ages.length)];
  const energy = Math.floor(Math.random() * 5) + 1;
  const sociability = Math.floor(Math.random() * 5) + 1;
  const training = Math.floor(Math.random() * 5) + 1;
  const barking = Math.floor(Math.random() * 5) + 1;
  
  return {
    id: `dog_${i + 1}`,
    owner_id: 'user_donor_1',
    name: name,
    breed: breed,
    age: age,
    photos: JSON.stringify([`https://picsum.photos/seed/dog_${i + 1}/800/1200`]),
    behavior: JSON.stringify({ energy, sociability, training, barking }),
    bio: `Oi! Eu sou o ${name}, um ${breed} muito especial procurando um lar cheio de carinho.`
  };
});

const seedUsers = [
  {
    id: 'user_donor_1',
    name: 'Abrigo Patas Felizes',
    email: 'contato@abrigo.com',
    role: 'DONOR',
    emoji: '🏠',
    bio: 'Instituição dedicada ao resgate de animais abandonados.'
  },
  {
    id: 'user_adopter_1',
    name: 'João Silva',
    email: 'joao@email.com',
    role: 'ADOPTER',
    emoji: '🙋‍♂️',
    bio: 'Apaixonado por animais buscando um novo amigo.'
  }
];

// Clear and Seed
db.exec("DELETE FROM messages; DELETE FROM matches; DELETE FROM dogs; DELETE FROM users;");

const insertUser = db.prepare("INSERT INTO users (id, name, email, role, emoji, bio) VALUES (?, ?, ?, ?, ?, ?)");
seedUsers.forEach(u => insertUser.run(u.id, u.name, u.email, u.role, u.emoji, u.bio));

const insertDog = db.prepare("INSERT INTO dogs (id, owner_id, name, breed, age, photos, behavior, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
seedDogs.forEach(d => insertDog.run(d.id, d.owner_id, d.name, d.breed, d.age, d.photos, d.behavior, d.bio));

// Seed some matches for the dashboard
const insertMatch = db.prepare("INSERT INTO matches (id, adopter_id, dog_id, status) VALUES (?, ?, ?, ?)");
insertMatch.run('m1', 'user_adopter_1', 'dog_1', 'ACCEPTED');
insertMatch.run('m2', 'user_adopter_1', 'dog_2', 'ACCEPTED');
insertMatch.run('m3', 'user_adopter_1', 'dog_5', 'ACCEPTED');
insertMatch.run('m4', 'user_adopter_1', 'dog_10', 'ACCEPTED');
insertMatch.run('m5', 'user_adopter_1', 'dog_15', 'ACCEPTED');

console.log("Database seeded successfully!");
