const {ApolloServer, gql, UserInputError} = require("apollo-server");
const mongoose = require("mongoose");
const Person = require("./models/person");
const {MONGODB_URI} = require("./config/config");

console.log('connecting to', MONGODB_URI);

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
    
    type Query {
        personCount: Int!
        allPersons(phone: YesNo): [Person!]!
        findPerson(name: String!): Person
    }
    
    type Mutation {
        addPerson(
            name: String!
            phone: String
            street: String!
            city: String!
        ): Person
        
        editNumber(input: EditNumberInput): Person
    }
`;

const resolvers = {
    Query: {
        personCount: () => Person.collection.countDocuments(),
        allPersons: (root, {phone}) => {
            if (!phone) return Person.find({});

            return Person.find({phone: {$exists: phone === 'YES'}});
        },
        findPerson: (root, {name}) => Person.findOne({name})
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
        addPerson: async (root, args) => {
            const person = new Person({...args});

            try {
                await person.save();
            } catch (e) {
                throw new UserInputError(e.message, {
                    invalidArgs: args
                });
            }

            return person;
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
        }
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers
});

server.listen().then(({url}) => {
    console.log(`Server ready at ${url}`);
});