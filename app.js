// importar módulos de terceros
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');

const dotenv = require('dotenv');
dotenv.config();

// importar las rutas públicas
const indexRoutes = require('./routes/index.js');

// importar las rutas de administrador
const adminRoutes = require('./routes/admin.js');

// rutas de autentificación
const authRoutes = require('./routes/auth.js');

const apiRoutes = require('./routes/api.js')

// creamos una instancia del servidor Express
const app = express();

// Tenemos que usar un nuevo middleware para indicar a Express que queremos procesar peticiones de tipo POST
app.use(express.urlencoded({ extended: true }));

// Set up session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // secure: true en producción con HTTPS
}));

// Set up flash middleware
app.use(flash());


app.use((req, res, next) => {
    // La variable req.locals es una variable "global" de tipo objecto a la que todas las vistas pueden acceder
    // Si el usuario esta autentificado entonces es que es de tipo administrador

    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    
    if (req.session.isAuthenticated) {
        // testing area
        res.locals.userData = userData

        res.locals.isAuthenticated = true;
        res.locals.isAdmin = req.session.userType === "admin"; // Check if admin
        res.locals.isUser = req.session.userType === "standard"; // Check if standard user
    } else {
        res.locals.isAuthenticated = false;
        res.locals.isAdmin = false;
        res.locals.isUser = false;
    }

    // tenemos que ejecutar next() para que la petición HTTP siga su curso
    next();
})

// Añadimos el middleware necesario para que el client puedo hacer peticiones GET a los recursos públicos de la carpeta 'public'
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Especificar a Express que quiero usar EJS como motor de plantillas
app.set('view engine', 'ejs');

// Usamos el middleware morgan para loguear las peticiones del cliente
app.use(morgan('tiny'));

// Añadimos las ritas de index.js en nuestra app
// El primer parámetro significa que todas las rutas que se encuentren en 'indexRouter' estarán prefijados por '/'
// Voy a prefijar todas las rutas de administrador con '/admin'

// Middleware para proteger las rutas de administrador
app.use('/admin', (req, res, next) => {
    // Miramos si el usuario esta autentificado
    if (req.session.isAuthenticated) {
        // Si es que si, establecemos que es de tipo administrador y permitimos que siga la petición
        res.locals.isAdmin = true;
        next();
    } else {
        // en caso contrario lo llevamos a la vista de login
        res.redirect('/login');
    }
});

app.use('/admin', adminRoutes);
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/api', apiRoutes)

async function connectDB() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a la base de datos');
}

connectDB().catch(err => console.log(err))

app.listen(PORT, (req, res) => {
    console.log("Servidor escuchando correctamente en el puerto " + PORT);
});
