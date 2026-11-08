--連弾魔女－フォルテ＆ソナタ
--Canon Witch - Forte & Sonata (original card)
local s,id=GetID()
local SET_CANON_WITCH=0x7c4
local CARD_A,CARD_B=77700501,77700503
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Must be Special Summoned from the Extra Deck by shuffling the materials from your hand/field into the Deck (no "Polymerization")
	local e0=Effect.CreateEffect(c)
	e0:SetType(EFFECT_TYPE_SINGLE)
	e0:SetProperty(EFFECT_FLAG_CANNOT_DISABLE+EFFECT_FLAG_UNCOPYABLE)
	e0:SetCode(EFFECT_SPSUMMON_CONDITION)
	e0:SetValue(s.splimit)
	c:RegisterEffect(e0)
	local ep=Effect.CreateEffect(c)
	ep:SetDescription(aux.Stringid(id,0))
	ep:SetType(EFFECT_TYPE_FIELD)
	ep:SetProperty(EFFECT_FLAG_UNCOPYABLE)
	ep:SetCode(EFFECT_SPSUMMON_PROC)
	ep:SetRange(LOCATION_EXTRA)
	ep:SetCondition(s.contactcon)
	ep:SetOperation(s.contactop)
	c:RegisterEffect(ep)
	c:SetSPSummonOnce(id)
	--① Special Summoned: destroy 2 cards the opponent controls
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,1))
	e1:SetCategory(CATEGORY_DESTROY)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetTarget(s.efftg)
	e1:SetOperation(s.effop)
	c:RegisterEffect(e1)
	--② either turn: Tribute this card, Special Summon 1 each of the two materials from the Deck
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,2))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetRange(LOCATION_MZONE)
	e2:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e2:SetCost(s.spcost)
	e2:SetTarget(s.sptg)
	e2:SetOperation(s.spop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CANON_WITCH}
s.listed_names={CARD_A,CARD_B}
s.material={CARD_A,CARD_B}
--only through the procedure below (no other way to Special Summon it from the Extra Deck)
function s.splimit(e,se,sp,st)
	return not e:GetHandler():IsLocation(LOCATION_EXTRA)
end
function s.matfilter(c,code)
	return c:IsCode(code) and (c:IsLocation(LOCATION_HAND) or c:IsFaceup()) and c:IsAbleToDeckOrExtraAsCost()
end
function s.matgroup(tp)
	local g=Duel.GetMatchingGroup(s.matfilter,tp,LOCATION_HAND+LOCATION_MZONE,0,nil,CARD_A)
	g:Merge(Duel.GetMatchingGroup(s.matfilter,tp,LOCATION_HAND+LOCATION_MZONE,0,nil,CARD_B))
	return g
end
function s.firstfilter(mc,tp,sc,mg)
	return mc:IsCode(CARD_A) and mg:IsExists(s.secondfilter,1,mc,tp,sc,mc)
end
function s.secondfilter(mc,tp,sc,first)
	return mc:IsCode(CARD_B) and Duel.GetLocationCountFromEx(tp,tp,Group.FromCards(first,mc),sc)>0
end
function s.contactcon(e,c)
	if c==nil then return true end
	local tp=c:GetControler()
	local mg=s.matgroup(tp)
	return mg:IsExists(s.firstfilter,1,nil,tp,c,mg)
end
function s.contactop(e,tp,eg,ep,ev,re,r,rp,c)
	local mg=s.matgroup(tp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TODECK)
	local a=mg:FilterSelect(tp,s.firstfilter,1,1,nil,tp,c,mg):GetFirst()
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TODECK)
	local b=mg:FilterSelect(tp,s.secondfilter,1,1,a,tp,c,a):GetFirst()
	local g=Group.FromCards(a,b)
	local hg=g:Filter(Card.IsLocation,nil,LOCATION_HAND)
	if #hg>0 then Duel.ConfirmCards(1-tp,hg) end
	c:SetMaterial(g)
	Duel.SendtoDeck(g,nil,SEQ_DECKSHUFFLE,REASON_COST+REASON_MATERIAL)
end
function s.efftg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(aux.TRUE,tp,0,LOCATION_ONFIELD,2,nil) end
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,nil,2,1-tp,LOCATION_ONFIELD)
end
function s.effop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local g=Duel.SelectMatchingCard(tp,aux.TRUE,tp,0,LOCATION_ONFIELD,2,2,nil)
	if #g>0 then
		Duel.HintSelection(g)
		Duel.Destroy(g,REASON_EFFECT)
	end
end
function s.spcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsReleasable() end
	Duel.Release(c,REASON_COST)
end
function s.spfilter(c,e,tp,code)
	return c:IsCode(code) and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	--59822133: Blue-Eyes Spirit Dragon (cannot Special Summon 2 or more at once)
	if chk==0 then return Duel.GetMZoneCount(tp,e:GetHandler())>=2
		and not Duel.IsPlayerAffectedByEffect(tp,59822133)
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_DECK,0,1,nil,e,tp,CARD_A)
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_DECK,0,1,nil,e,tp,CARD_B) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,2,tp,LOCATION_DECK)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.GetLocationCount(tp,LOCATION_MZONE)<2 or Duel.IsPlayerAffectedByEffect(tp,59822133) then return end
	local ga=Duel.GetMatchingGroup(s.spfilter,tp,LOCATION_DECK,0,nil,e,tp,CARD_A)
	local gb=Duel.GetMatchingGroup(s.spfilter,tp,LOCATION_DECK,0,nil,e,tp,CARD_B)
	if #ga==0 or #gb==0 then return end
	local g=Group.FromCards(ga:GetFirst(),gb:GetFirst())
	Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP)
end
