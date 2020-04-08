import Link from 'next/link';
import gql from 'graphql-tag';
import Layout from '../components/Layout';

import { useRouter } from 'next/router'
import { useUser } from '../data/User';
import { useMutation } from '@apollo/react-hooks';
import React, { useState, useCallback } from 'react';
import { Button, Form, Grid, Loader, Message } from 'semantic-ui-react';

const QUERY = gql`
  mutation login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

export default function Login() {
  const user = useUser();
  const router = useRouter()

  const [email, setEmail] = useState('');
  const [login, { called, loading, data, error }] = useMutation(QUERY);

  const handleSubmit = useCallback(
    ({ currentTarget }) => {
      const form = new FormData(currentTarget);

      login({
        variables: {
          input: {
            password: form.get('password'),
            email: form.get('email').toLowerCase(),
          },
        },
      });
    },
    [login],
  );


  console.log('user is logged in', user.isLoggedIn());
  if (user.isLoggedIn()) {
    return router.push('/account')
  }

  if (data) {
    user.login(data.login.accessToken);
    router.push('/')
    window.location.reload();
  }

  return (
    <Layout>
      <Grid textAlign='center' style={{ marginTop: '50px' }} verticalAlign='middle'>
        <Grid.Column style={{ maxWidth: 450 }}>
          {error ? (
            <Message
              error
              header='There was some errors with your submission'
              list={error.graphQLErrors.map(e => e.message)}
            />
          ) : null}

          {called && loading ? <Loader active /> : null}

          <Form size='large' onSubmit={handleSubmit}>
            <fieldset disabled={loading} style={{ padding: 'none', border: 'none' }}>
              <Form.Input
                fluid
                icon='mail'
                name='email'
                iconPosition='left'
                value={email}
                onChange={(e, { value }) => {
                  setEmail(value.toLowerCase());
                }}
                placeholder='E-mail address'
              />
              <Form.Input
                fluid
                icon='lock'
                type='password'
                name='password'
                iconPosition='left'
                placeholder='Password'
              />

              <Grid>
                <Grid.Column width={10}>
                  <Form.Button color='teal' fluid content='Login' />
                </Grid.Column>
                <Grid.Column width={6}>
                  <Link href='/register'>
                    <Button as='a' to='/register' basic fluid color='teal' content='Or Register' />
                  </Link>
                </Grid.Column>
              </Grid>
            </fieldset>
          </Form>
        </Grid.Column>
      </Grid>
    </Layout>
  )
}
