import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { destroyAppSession } from '~/lib/sessions.server';

/**
 * Logout route - destroys the app session and redirects to home
 */
export async function action({ request }: ActionFunctionArgs) {
  const destroyCookie = await destroyAppSession(request);
  
  return redirect('/', {
    headers: {
      'Set-Cookie': destroyCookie,
    },
  });
}

/**
 * GET requests redirect to home
 */
export async function loader() {
  return redirect('/');
}

