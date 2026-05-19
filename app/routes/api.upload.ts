import type { Route } from './+types/api.upload';

import { getMaxFileSize, uploadImage } from '~/lib/r2.server';
import {
  ensureAuthenticatedApiRequest,
  handleApiOptionsRequest,
  jsonWithApiCors,
} from '~/lib/session.server';

const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function action({ request }: Route.ActionArgs) {
  if (request.method === 'OPTIONS') {
    return handleApiOptionsRequest(request);
  }

  const authError = await ensureAuthenticatedApiRequest(request);
  if (authError) {
    return authError;
  }

  if (request.method !== 'POST') {
    return jsonWithApiCors(request, { error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonWithApiCors(
        request,
        { error: 'No file provided' },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const maxSize = getMaxFileSize();
    if (file.size > maxSize) {
      return jsonWithApiCors(
        request,
        { error: `File size exceeds limit of ${maxSize / 1024 / 1024}MB` },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    if (!allowedTypes.includes(file.type)) {
      return jsonWithApiCors(
        request,
        { error: 'Invalid file type. Only images are allowed.' },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const imageInfo = await uploadImage(file, {
      useHashName: formData.get('useHashName') === 'true',
    });

    return jsonWithApiCors(
      request,
      {
        success: true,
        data: imageInfo,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return jsonWithApiCors(
      request,
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
