import type React from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { todayIT, dateIT } from '../../lib/dateIT'
import { isAdmin, isCoach, isParent, isAthlete, avatarBg } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { PlayerDetailSheet, type PlayerDetailData } from '../../components/PlayerDetailSheet'
import { AttendanceSheet } from '../../components/AttendanceSheet'
import { EventEditSheet } from '../../components/EventEditSheet'
import { DatabaseBackupSheet } from '../../components/DatabaseBackupSheet'
import { TrainingExerciseCatalogSheet } from '../../components/TrainingExerciseCatalogSheet'
import { BottomSheet } from '../../components/BottomSheet'
import { MedicalComplianceSheet } from '../../components/MedicalComplianceSheet'
import { PresenceLogSheet } from '../../components/PresenceLogSheet'
import { ParentAttendanceSheet } from '../../components/ParentAttendanceSheet'
import { CalendarSubscribeSheet } from '../../components/CalendarSubscribeSheet'
import { DirectorDashboard } from '../../components/DirectorDashboard'
import { ManagerDashboard } from '../../components/ManagerDashboard'
import { CoachPlayerStatsDashboard } from '../../components/CoachPlayerStatsDashboard'
import { TeamPickerSheet } from '../../components/TeamPickerSheet'
import { ShuttleServiceCard } from '../../components/ShuttleServiceCard'
import { AdminStaffOverviewCard } from '../../components/AdminStaffOverviewCard'
import { WeekendPlannerCard } from '../../components/WeekendPlannerCard'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { extractCity, isTournamentCompetition, HOME_CITY } from '../../lib/eventLocation'
import { useMyTeam } from '../../hooks/useMyTeam'
import { useViewMode } from '../../store/viewMode'
import { useImpersonation } from '../../store/impersonation'


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
