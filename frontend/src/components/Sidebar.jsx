import { NavLink, useNavigate, Link } from 'react-router-dom';
import { Nav, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import CreditsBar from './CreditsBar';
import BrandLogo from './BrandLogo';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/store', label: 'Store Overview', icon: '🏪' },
  { to: '/generator', label: 'AI Generator', icon: '✨' },
  { to: '/bulk-upload', label: 'Bulk Upload', icon: '📤' },
  { to: '/title-generator', label: 'Title Generator', icon: '📝' },
  { to: '/meta-generator', label: 'Meta Generator', icon: '🔍' },
  { to: '/seo-audit', label: 'SEO Audit', icon: '📋' },
  { to: '/translator', label: 'Translator', icon: '🌐' },
  { to: '/schema-generator', label: 'Schema', icon: '{ }' },
  { to: '/image-optimizer', label: 'Image Optimizer', icon: '🖼️' },
  { to: '/projects', label: 'Saved Projects', icon: '💾' },
  { to: '/history', label: 'History', icon: '🕐' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/support', label: 'Support', icon: '💬' },
];

const adminNavItem = { to: '/admin', label: 'Admin', icon: '🛡️' };

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavLink = (item) => {
    const link = (
      <NavLink
        key={item.to}
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `nav-link text-white rounded sidebar-link ${isActive ? 'bg-primary' : 'hover-bg-secondary'} ${
            collapsed ? 'sidebar-link-collapsed' : ''
          }`
        }
        style={{ textDecoration: 'none' }}
      >
        <span className="sidebar-icon">{item.icon}</span>
        {!collapsed && <span className="sidebar-label">{item.label}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <OverlayTrigger key={item.to} placement="right" overlay={<Tooltip>{item.label}</Tooltip>}>
          <span className="d-block">{link}</span>
        </OverlayTrigger>
      );
    }

    return link;
  };

  return (
    <aside className={`sidebar text-white d-flex flex-column ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className={`sidebar-header border-bottom border-secondary ${collapsed ? 'sidebar-header-collapsed' : ''}`}>
        <div className={`sidebar-brand ${collapsed ? 'sidebar-brand-collapsed' : ''}`}>
          {collapsed ? (
            <BrandLogo showText={false} className="sidebar-favicon" />
          ) : (
            <>
              <BrandLogo variant="dark" className="brand-logo-sidebar mb-2" />
              <small className="text-secondary">Optimize products with AI</small>
            </>
          )}
        </div>
        <Button
          variant="outline-light"
          size="sm"
          className={`sidebar-toggle ${collapsed ? 'sidebar-toggle-collapsed' : ''}`}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </Button>
      </div>

      <Nav className="flex-column sidebar-nav gap-1 flex-grow-1">
        {navItems.map(renderNavLink)}
        {user?.role === 'admin' && renderNavLink(adminNavItem)}
      </Nav>

      <div className="sidebar-footer border-top border-secondary">
        <CreditsBar collapsed={collapsed} />
        {!collapsed && user?.plan !== 'pro' && (
          <div className="px-2 mb-2">
            <Link to="/pricing" className="btn btn-primary btn-sm w-100 fw-semibold">
              ⭐ Upgrade to Pro
            </Link>
          </div>
        )}
        {!collapsed && (
          <div className="mb-2 px-2">
            <small className="text-secondary d-block text-truncate">{user?.name}</small>
            <span className="badge bg-secondary text-uppercase">{user?.plan || 'free'}</span>
          </div>
        )}

        {collapsed ? (
          <OverlayTrigger placement="right" overlay={<Tooltip>Logout</Tooltip>}>
            <Button
              variant="outline-light"
              size="sm"
              className="sidebar-logout-collapsed"
              onClick={handleLogout}
            >
              ⏻
            </Button>
          </OverlayTrigger>
        ) : (
          <Button variant="outline-light" size="sm" className="w-100" onClick={handleLogout}>
            Logout
          </Button>
        )}
      </div>
    </aside>
  );
}
