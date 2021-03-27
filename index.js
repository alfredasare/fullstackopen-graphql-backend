const {ApolloServer, gql, UserInputError, AuthenticationError, PubSub} = require("apollo-server");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Person = require("./models/person");
const User = require("./models/user");
const {MONGODB_URI} = require("./config/config");

console.log('connecting to', MONGODB_URI);

const pubsub = new PubSub();

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
})
    .then(() => {
        console.log('connected to MongoDB');
    })
    .catch((error) => {
        console.log('error connection to MongoDB:', error.message);
    });

const JWT_SECRET = process.env.JWT_SECRET;

const typeDefs = gql`
    type Person {
        name: String!
        phone: String
        address: Address!
        id: ID!
    }
    
    type Address {
        street: String!
        city: String!
    }
    
    enum YesNo {
        YES
        NO
    }
    
    input EditNumberInput {
        name: String!
        phone: String!
    }
    
    input LoginCredentials {
        username: String!
        password: String!
    }
    
    type User {
        username: String!
        friends: [Person!]!
        id: ID!
    }
    
    type Token {
        value: String!
    }
    
    type Query {
        personCount: Int!
        allPersons(phone: YesNo): [Person!]!
        findPerson(name: String!): Person
        me: User
    }
    
    type Mutation {
        addPerson(
            name: String!
            phone: String
            street: String!
            city: String!
        ): Person
        
        editNumber(input: EditNumberInput): Person
        
        createUser(username: String!): User
        
        login(input: LoginCredentials): Token,
        
        addAsFriend(name: String!): User
    }
    
    type Subscription {
        personAdded: Person!
    }
`;

const resolvers = {
    Query: {
        personCount: () => Person.collection.countDocuments(),
        allPersons: (root, {phone}) => {
            if (!phone) return Person.find({});

            return Person.find({phone: {$exists: phone === 'YES'}});
        },
        findPerson: (root, {name}) => Person.findOne({name}),
        me: (root, args, context) => {
            return context.currentUser;
        }
    },

    //  Default resolver
    Person: {
        address: (root) => {
            return {
                street: root.street,
                city: root.city
            };
        }
    },

    Mutation: {
        addPerson: async (root, args, {currentUser}) => {
            const person = new Person({...args});

            if (!currentUser) {
                throw new AuthenticationError("not authenticated");
            }

            try {
                await person.save();
                currentUser.friends = currentUser.friends.concat(person);
                await currentUser.save();
            } catch (e) {
                throw new UserInputError(e.message, {
                    invalidArgs: args
                });
            }

            await pubsub.publish('PERSON_ADDED', {
                personAdded: person
            });

            return person;
        },

        addAsFriend: async (root, args, {currentUser}) => {
            const nonFriendAlready = person => !currentUser.friends.map(f => f._id).includes(person._id);

            if (!currentUser) {
                throw new AuthenticationError("not authenticated");
            }

            const person = await Person.findOne({name: args.name});
            if (nonFriendAlready(person)) {
                currentUser.friends = currentUser.friends.concat(person);
            }

            await currentUser.save();

            return currentUser;
        },

        editNumber: async (root, {input}) => {
            const person = await Person.findOne({name: input.name});
            person.phone = input.phone;

            try {
                await person.save();
            } catch (e) {
                throw new UserInputError(e.message, {
                    invalidArgs: input
                });
            }

            return person;
        },

        createUser: (root, {username}) => {
            const user = new User({username});

            return user.save()
                .catch(e => {
                    throw new UserInputError(e.message, {
                        invalidArgs: username
                    });
                });
        },

        login: async(root, {input}) => {
            const user = await User.findOne({username: input.username});

            if (!user || input.password !== 'plusultra') {
                throw new UserInputError("wrong credentials");
            }

            const userForToken = {
                username: user.username,
                id: user._id
            }

            return {value: jwt.sign(userForToken, JWT_SECRET)};
        }
    },

    Subscription: {
        personAdded: {
            subscribe: () => pubsub.asyncIterator(['PERSON_ADDED'])
        }
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({req}) => {
        const auth = req ? req.headers.authorization: null;
        if (auth && auth.toLowerCase().startsWith('bearer ')) {
            const decodedToken = jwt.verify(
                auth.substring(7), JWT_SECRET
            );
            const currentUser = await User.findById(decodedToken.id).populate('friends')
            return {currentUser};
        }
    }
});

server.listen().then(({url, subscriptionsUrl}) => {
    console.log(`Server ready at ${url}`);
    console.log(`Subscriptions ready at ${subscriptionsUrl}`);
});