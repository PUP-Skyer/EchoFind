import whiteRabbit from '@client/src/assets/pets/01_white_rabbit.png';
import orangeFox from '@client/src/assets/pets/02_orange_fox.png';
import grayWhiteCat from '@client/src/assets/pets/03_gray_white_cat.png';
import redPanda from '@client/src/assets/pets/04_red_panda.png';
import shiba from '@client/src/assets/pets/05_shiba.png';
import blueSmurf from '@client/src/assets/pets/06_blue_smurf.png';
import greenFrog from '@client/src/assets/pets/07_green_frog.png';
import yellowDuck from '@client/src/assets/pets/08_yellow_duck.png';
import pinkPig from '@client/src/assets/pets/09_pink_pig.png';
import brownBear from '@client/src/assets/pets/10_brown_bear.png';
import purpleMonster from '@client/src/assets/pets/11_purple_monster.png';
import whiteSeal from '@client/src/assets/pets/12_white_seal.png';
import orangeHamster from '@client/src/assets/pets/13_orange_hamster.png';
import cyanDragon from '@client/src/assets/pets/14_cyan_dragon.png';
import grayPenguin from '@client/src/assets/pets/15_gray_penguin.png';
import type { PetType } from '@shared/api.interface';

export const PET_INFO: { type: PetType; name: string; image: string }[] = [
  { type: 'white_rabbit', name: '白兔', image: whiteRabbit },
  { type: 'orange_fox', name: '橘狐', image: orangeFox },
  { type: 'gray_white_cat', name: '灰白猫', image: grayWhiteCat },
  { type: 'red_panda', name: '小熊猫', image: redPanda },
  { type: 'shiba', name: '柴犬', image: shiba },
  { type: 'blue_smurf', name: '蓝精灵', image: blueSmurf },
  { type: 'green_frog', name: '绿青蛙', image: greenFrog },
  { type: 'yellow_duck', name: '黄小鸭', image: yellowDuck },
  { type: 'pink_pig', name: '粉小猪', image: pinkPig },
  { type: 'brown_bear', name: '棕熊', image: brownBear },
  { type: 'purple_monster', name: '淡紫小怪兽', image: purpleMonster },
  { type: 'white_seal', name: '白海豹', image: whiteSeal },
  { type: 'orange_hamster', name: '橙仓鼠', image: orangeHamster },
  { type: 'cyan_dragon', name: '青小龙', image: cyanDragon },
  { type: 'gray_penguin', name: '灰企鹅', image: grayPenguin },
];

export const PET_IMAGE_MAP: Record<PetType, string> = PET_INFO.reduce(
  (acc, pet) => {
    acc[pet.type] = pet.image;
    return acc;
  },
  {} as Record<PetType, string>,
);

export const PET_NAME_MAP: Record<PetType, string> = PET_INFO.reduce(
  (acc, pet) => {
    acc[pet.type] = pet.name;
    return acc;
  },
  {} as Record<PetType, string>,
);

export const DEFAULT_PET: PetType = 'cyan_dragon';
