import { emerce } from "./emerce";
import { ft } from "./ft";
import { limburger } from "./limburger";
import { trouw } from "./trouw";
import { volkskrant } from "./volkskrant";

export const singleSites = {
  ...limburger,
  ...trouw,
  ...volkskrant,
  ...ft,
  ...emerce,
};
