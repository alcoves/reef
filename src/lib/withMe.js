import userPool from './userPool';
import { useState, useEffect } from 'react';

function withMe() {
  const [me, setMe] = useState({ loading: true, me: null, error: null });

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser !== null) {
      cognitoUser.getSession(function (err, session) {
        if (err) setMe({ error: err.message || JSON.stringify(err) });
        console.log('session validity: ' + session.isValid());
        cognitoUser.getUserAttributes(function (err, attributes) {
          if (err) {
            setMe({ error: err.message || JSON.stringify(err) });
          } else {
            console.log('attributes', attributes);
            setMe({
              loading: false,
              me: attributes.reduce((acc, { Name, Value }) => {
                acc[Name] = Value;
                return acc;
              }, {}),
            });
          }
        });
      });
    }
  }, []);

  return me;
}

export default withMe;
