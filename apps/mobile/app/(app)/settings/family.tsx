import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { supabase } from '../../../src/lib/supabase';
import { inventoryStore } from '../../../src/stores/inventory.store';
import { authStore } from '../../../src/stores/auth.store';
import { AnimatedPressable, ConfirmDialog, useToast } from '@medstock/ui';
import { hapticError } from '../../../src/lib/haptics';

interface Member {
  profile_id: string;
  role: 'owner' | 'editor' | 'viewer';
  full_name: string;
}

const ROLE_LABEL: Record<Member['role'], string> = {
  owner:  'Dono',
  editor: 'Editor',
  viewer: 'Visualizador',
};

const ROLE_COLORS: Record<Member['role'], { bg: string; text: string }> = {
  owner:  { bg: '#EAF6F5', text: '#1A9E96' },
  editor: { bg: '#FEF3D9', text: '#D97706' },
  viewer: { bg: '#E8ECE5', text: '#5A625A' },
};

export default function FamilyScreen() {
  const toast = useToast();
  const familyId = useSelector(inventoryStore.familyId);
  const currentUserId = useSelector(authStore.session)?.user.id;
  const [familyName, setFamilyName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  useEffect(() => {
    if (familyId) void loadFamily();
  }, [familyId]);

  async function loadFamily() {
    if (!familyId) return;
    setLoading(true);

    const [familyRes, membersRes] = await Promise.all([
      supabase.from('families').select('name').eq('id', familyId).single(),
      supabase.rpc('get_family_members', { p_family_id: familyId }),
    ]);

    if (familyRes.data) setFamilyName(familyRes.data.name);

    const rows = (membersRes.data ?? []) as Member[];
    setMembers(rows);
    setIsOwner(rows.some(m => m.profile_id === currentUserId && m.role === 'owner'));
    setLoading(false);
  }

  async function confirmRemove() {
    if (!removeTarget || !familyId) { setRemoveTarget(null); return; }
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('family_id', familyId)
      .eq('profile_id', removeTarget.profile_id);
    const target = removeTarget;
    setRemoveTarget(null);
    if (error) {
      toast.show('error', 'Erro', error.message);
      hapticError();
    } else {
      setMembers(prev => prev.filter(m => m.profile_id !== target.profile_id));
      toast.show('success', 'Removido', `${target.full_name} foi removido da família.`);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => { router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={styles.title}>Família</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A9E96" />
        </View>
      ) : (
        <>
          <View style={styles.nameCard}>
            <Text style={styles.nameLabel}>Nome do grupo</Text>
            <Text style={styles.nameValue}>{familyName}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Membros ({members.length})
              </Text>
              {isOwner && (
                <AnimatedPressable
                  style={styles.inviteBtn}
                  onPress={() => { router.push('/(app)/settings/invite'); }}
                >
                  <Text style={styles.inviteBtnText}>+ Convidar</Text>
                </AnimatedPressable>
              )}
            </View>

            <FlatList
              data={members}
              keyExtractor={m => m.profile_id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const colors = ROLE_COLORS[item.role];
                const canRemove =
                  isOwner &&
                  item.profile_id !== currentUserId &&
                  item.role !== 'owner';
                return (
                  <View style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{item.full_name}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.roleText, { color: colors.text }]}>
                          {ROLE_LABEL[item.role]}
                        </Text>
                      </View>
                    </View>
                    {canRemove && (
                      <AnimatedPressable
                        onPress={() => { setRemoveTarget(item); }}
                        style={styles.removeBtn}
                        hitSlop={8}
                      >
                        <Text style={styles.removeText}>Remover</Text>
                      </AnimatedPressable>
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </>
      )}

      <ConfirmDialog
        visible={removeTarget !== null}
        title="Remover membro"
        message={`Remover ${removeTarget?.full_name ?? ''} da família?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { void confirmRemove(); }}
        onCancel={() => { setRemoveTarget(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F6F8F5' },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn:       { paddingRight: 4 },
  backText:      { color: '#1A9E96', fontSize: 15 },
  title:         { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nameCard:      { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E0E4E0', marginBottom: 16 },
  nameLabel:     { fontSize: 12, color: '#5A625A', marginBottom: 4 },
  nameValue:     { fontSize: 17, fontWeight: '600', color: '#1A1D1A' },
  section:       { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E0E4E0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1D1A' },
  inviteBtn:     { backgroundColor: '#1A9E96', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  inviteBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  memberRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  memberInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName:    { fontSize: 14, fontWeight: '500', color: '#1A1D1A' },
  roleBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:      { fontSize: 11, fontWeight: '700' },
  removeBtn:     { paddingLeft: 8 },
  removeText:    { color: '#F0735A', fontSize: 13, fontWeight: '600' },
  separator:     { height: 1, backgroundColor: '#E8ECE5', marginHorizontal: 16 },
});
