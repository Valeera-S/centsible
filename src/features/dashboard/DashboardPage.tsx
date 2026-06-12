import { strings } from '../../i18n/strings';

export function DashboardPage() {
  return (
    <section className="dashboard-page">
      <h1>{strings.nav.dashboard}</h1>
      <p>{strings.dashboard.comingSoon}</p>
    </section>
  );
}
