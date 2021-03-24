const {ApolloServer, gql, UserInputError} = require("apollo-server");
const {v1: uuid} = require("uuid");

let persons = [
    {
        name: "Arto Hellas",
        phone: "040-123543",
        street: "Tapiolankatu 5 A",
        city: "Espoo",
        id: "3d594650-3436-11e9-bc57-8b80ba54c431"
    },
    {
        name: "Matti Luukkainen",
        phone: "040-432342",
        street: "Malminkaari 10 A",
        city: "Helsinki",
        id: '3d599470-3436-11e9-bc57-8b80ba54c431'
    },
    {
        name: "Venla Ruuska",
        street: "Nallemäentie 22 C",
        city: "Helsinki",
        id: '3d599471-3436-11e9-bc57-8b80ba54c431'
    },
];

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
        personCount: () => persons.length,
        allPersons: (root, {phone}) => {
            if (!phone) return persons;
            const byPhone = (person) => phone === "YES"? person.phone : !person.phone;
            return persons.filter(byPhone);
        },
        findPerson: (root, {name}) => persons.find(p => p.name === name)
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
        addPerson: (root, args) => {
            if (persons.find(p => args.name === p.name)) {
                throw new UserInputError('Name must be unique', {
                    invalidArgs: args.name
                });
            }

            const person = {...args, id: uuid()};
            persons = persons.concat(person);
            return person;
        },

        editNumber: (root, {input}) => {
            const person = persons.find(p => p.name === input.name);
            if (!person) return null;

            const updatedPerson = {...person, phone: input.phone};
            persons = persons.map(p => p.name === input.name ? updatedPerson : p);
            return updatedPerson;
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