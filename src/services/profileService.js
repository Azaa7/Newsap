import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { firestoreDb, firebaseStorage } from '../config/firebase';

const toTrimmed = (value) => String(value || '').trim();

const buildDataUrl = ({ base64, mimeType }) => {
  const safeBase64 = toTrimmed(base64);
  if (!safeBase64) return null;
  const safeMime = toTrimmed(mimeType) || 'image/jpeg';
  return `data:${safeMime};base64,${safeBase64}`;
};

export const profileService = {
  /**
   * Updates the user's profile in Firestore. Optionally uploads avatar image to Firebase Storage.
   * @param {object} params
   * @param {string} params.userId
   * @param {string=} params.name
   * @param {string=} params.avatarBase64
   * @param {string=} params.avatarMimeType
    * @param {string=} params.avatarUrl
   */
    async updateProfile({ userId, name, avatarBase64, avatarMimeType, avatarUrl } = {}) {
    const uid = toTrimmed(userId);
    if (!uid) {
      throw new Error('Missing userId');
    }

    const nextName = toTrimmed(name);
    const dataUrl = buildDataUrl({ base64: avatarBase64, mimeType: avatarMimeType });
    const directAvatarUrl = toTrimmed(avatarUrl);

    let profileImage = null;

    if (dataUrl) {
      const avatarRef = ref(firebaseStorage, `users/${uid}/avatar`);
      await uploadString(avatarRef, dataUrl, 'data_url');
      profileImage = await getDownloadURL(avatarRef);
    } else if (directAvatarUrl) {
      profileImage = directAvatarUrl;
    }

    const payload = {
      updatedAt: serverTimestamp(),
    };

    if (nextName) payload.name = nextName;
    if (profileImage) payload.profileImage = profileImage;

    await setDoc(doc(firestoreDb, 'users', uid), payload, { merge: true });

    return {
      ...(nextName ? { name: nextName } : null),
      ...(profileImage ? { profileImage } : null),
    };
  },
};
