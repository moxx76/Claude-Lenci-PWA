// PublicDashboard è un placeholder statico: nessun import oltre React basta.


function PublicDashboard({ firstName }: { firstName: string }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 18, padding: 22, textAlign: 'center',
        boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg,#005f98,#0078bf)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, margin: '0 auto 12px',
        }}
      >
        LP
      </div>
      <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20', margin: 0 }}>
        Ciao {firstName || 'ospite'}!
      </h2>
      <p style={{ fontSize: 13, color: '#404751', margin: '8px 0 0' }}>
        Il tuo account è attivo. Contatta la segreteria per assegnare il tuo ruolo.
      </p>
    </div>
  )
}

export default PublicDashboard
