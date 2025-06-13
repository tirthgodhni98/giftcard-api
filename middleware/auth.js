const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Debug headers
        console.log('\n=== Auth Middleware Debug ===');
        console.log('All Headers:', req.headers);
        
        // Try different header formats
        const userEmail = req.headers['x-user-email'] || 
                         req.headers['X-User-Email'] || 
                         req.headers['x-user-email'] || 
                         req.headers['X-USER-EMAIL'];
        
        console.log('User Email from headers:', userEmail);
        
        if (!userEmail) {
            console.log('No user email found in headers');
            req.user = null;
            return next();
        }

        // Find or create the user
        let user = await User.findOne({ email: userEmail });
        console.log('Existing user found:', user ? 'Yes' : 'No');
        
        if (!user) {
            // Create a new user if they don't exist
            const userName = req.headers['x-user-name'] || 
                           req.headers['X-User-Name'] || 
                           req.headers['x-user-name'] || 
                           req.headers['X-USER-NAME'] || 
                           'Unknown User';
            
            console.log('Creating new user with name:', userName);
            
            user = new User({
                email: userEmail,
                name: userName,
                lastLogin: new Date()
            });
            await user.save();
            console.log('New user created:', user.email);
        } else {
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            console.log('Existing user updated:', user.email);
        }

        // Attach user to request
        req.user = user;
        console.log('User attached to request:', req.user.email);
        console.log('=== End Auth Middleware Debug ===\n');
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        req.user = null;
        next();
    }
};

module.exports = auth; 