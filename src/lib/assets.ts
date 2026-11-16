import royalStageImg from '../assets/images/sada_royal_stage_1794789002319.jpg';
import competitionCrestImg from '../assets/images/sada_competition_crest_1794789004221.jpg';
import hostMaleImg from '../assets/images/sada_avatar_host_male_1794789003591.jpg';
import hostFemaleImg from '../assets/images/sada_avatar_host_female_1794789005258.jpg';
import emblemImg from '../assets/images/sada_app_emblem_1794789005281.jpg';

export const ASSET_MAP: Record<string, string> = {
  royal_stage: royalStageImg,
  competition_crest: competitionCrestImg,
  host_male: hostMaleImg,
  host_female: hostFemaleImg,
  emblem: emblemImg,
};

export function resolveAsset(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return emblemImg;
  if (ASSET_MAP[keyOrUrl]) return ASSET_MAP[keyOrUrl];
  return keyOrUrl;
}

export const AVATAR_CHOICES = [
  { id: 'host_male', label: 'إطلالة المذيع الملكي', src: hostMaleImg },
  { id: 'host_female', label: 'إطلالة الشاعرة الملكية', src: hostFemaleImg },
  { id: 'emblem', label: 'شعار صَدَى الذهبي', src: emblemImg },
];
