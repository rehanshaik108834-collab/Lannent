import { DeliverableAliasPage } from './DeliverablePages';

export { WorkroomPage, MilestoneBoardPage } from './ProjectPages';
export {
  SubmitDeliverablePage,
  ReviewDeliverablePage,
} from './DeliverablePages';

export const SubmitAliasPage = () => <DeliverableAliasPage mode="submit" />;
export const ReviewAliasPage = () => <DeliverableAliasPage mode="review" />;
